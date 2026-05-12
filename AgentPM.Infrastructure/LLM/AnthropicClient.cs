using System.Net;
using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using AgentPM.Domain;
using AgentPM.Domain.Interfaces;
using Microsoft.Extensions.Options;

namespace AgentPM.Infrastructure.LLM;

public sealed class AnthropicClient : ILLMClient
{
    private readonly HttpClient _httpClient;
    private readonly HttpClient _voyageClient;
    private readonly AnthropicOptions _options;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public AnthropicClient(IHttpClientFactory factory, IOptions<AnthropicOptions> options)
    {
        _options = options.Value;
        _httpClient = factory.CreateClient("Anthropic");
        _voyageClient = factory.CreateClient("Voyage");
    }

    // ── GenerateAsync ──────────────────────────────────────────────────────────
    public async Task<string> GenerateAsync(
        string systemPrompt, string userPrompt, LLMSettings settings, CancellationToken ct = default)
    {
        var payload = new
        {
            model      = settings.Model,
            max_tokens = settings.MaxTokens,
            system     = systemPrompt,
            messages   = new[] { new { role = "user", content = userPrompt } }
        };

        var response = await ExecuteWithRetryAsync(
            () => _httpClient.PostAsJsonAsync("/v1/messages", payload, JsonOpts, ct));

        await EnsureSuccessAsync(response, ct);

        using var doc = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);

        return doc.RootElement
            .GetProperty("content")[0]
            .GetProperty("text")
            .GetString() ?? string.Empty;
    }

    // ── GenerateWithToolsAsync (Anthropic tool_use) ────────────────────────────
    public async Task<LLMToolResponse> GenerateWithToolsAsync(
        string systemPrompt,
        IReadOnlyList<LLMMessage> messages,
        IReadOnlyList<LLMTool> tools,
        LLMSettings settings,
        CancellationToken ct = default)
    {
        var msgArray = messages.Select(m => new
        {
            role    = m.Role,
            content = m.Content
        }).ToArray();

        var toolsArray = tools.Select(t => new
        {
            name         = t.Name,
            description  = t.Description,
            input_schema = t.InputSchema
        }).ToArray();

        var payload = new
        {
            model      = settings.Model,
            max_tokens = settings.MaxTokens,
            system     = systemPrompt,
            tools      = toolsArray,
            messages   = msgArray
        };

        var json    = JsonSerializer.Serialize(payload, JsonOpts);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await ExecuteWithRetryAsync(
            () => _httpClient.PostAsync("/v1/messages", content, ct));

        await EnsureSuccessAsync(response, ct);

        using var doc = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);

        var root       = doc.RootElement;
        var stopReason = root.TryGetProperty("stop_reason", out var sr) ? sr.GetString() : null;
        string? textContent = null;
        var toolUses = new List<LLMToolUse>();

        if (root.TryGetProperty("content", out var contentArr))
        {
            foreach (var block in contentArr.EnumerateArray())
            {
                var type = block.TryGetProperty("type", out var t) ? t.GetString() : null;

                if (type == "text" && block.TryGetProperty("text", out var txt))
                    textContent = txt.GetString();

                else if (type == "tool_use")
                {
                    var id    = block.TryGetProperty("id",    out var idProp)   ? idProp.GetString()   ?? "" : "";
                    var name  = block.TryGetProperty("name",  out var nameProp) ? nameProp.GetString() ?? "" : "";
                    var input = block.TryGetProperty("input", out var inputProp)
                        ? inputProp.Clone()
                        : JsonDocument.Parse("{}").RootElement;
                    toolUses.Add(new LLMToolUse(id, name, input));
                }
            }
        }

        return new LLMToolResponse(stopReason, textContent, toolUses);
    }

    // ── StreamAsync (SSE) ──────────────────────────────────────────────────────
    public async IAsyncEnumerable<string> StreamAsync(
        string systemPrompt,
        string userPrompt,
        LLMSettings settings,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var payload = new
        {
            model      = settings.Model,
            max_tokens = settings.MaxTokens,
            system     = systemPrompt,
            stream     = true,
            messages   = new[] { new { role = "user", content = userPrompt } }
        };

        var json           = JsonSerializer.Serialize(payload, JsonOpts);
        var requestContent = new StringContent(json, Encoding.UTF8, "application/json");
        var request        = new HttpRequestMessage(HttpMethod.Post, "/v1/messages")
        {
            Content = requestContent
        };
        request.Headers.Add("Accept", "text/event-stream");

        string? earlyError = null;
        HttpResponseMessage? response = null;
        try
        {
            response = await _httpClient.SendAsync(request,
                HttpCompletionOption.ResponseHeadersRead, ct);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                earlyError = $"[Erreur Anthropic {(int)response.StatusCode}: {body}]";
            }
        }
        catch (Exception ex)
        {
            earlyError = $"[Erreur streaming: {ex.Message}]";
        }

        if (earlyError is not null)
        {
            yield return earlyError;
            yield break;
        }

        using var stream = await response!.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(stream);

        while (!ct.IsCancellationRequested)
        {
            var line = await reader.ReadLineAsync(ct);
            if (line is null) break;
            if (!line.StartsWith("data: ")) continue;

            var data = line["data: ".Length..].Trim();
            if (data == "[DONE]") break;

            JsonDocument? eventDoc = null;
            try { eventDoc = JsonDocument.Parse(data); }
            catch { continue; }

            using (eventDoc)
            {
                var root = eventDoc.RootElement;
                if (!root.TryGetProperty("type", out var typeProp)) continue;
                if (typeProp.GetString() != "content_block_delta") continue;

                if (root.TryGetProperty("delta",   out var delta)     &&
                    delta.TryGetProperty("type",    out var deltaType) &&
                    deltaType.GetString() == "text_delta"              &&
                    delta.TryGetProperty("text",    out var textProp))
                {
                    var token = textProp.GetString();
                    if (!string.IsNullOrEmpty(token))
                        yield return token;
                }
            }
        }
    }

    // ── GetEmbeddingsAsync ─────────────────────────────────────────────────────
    public async Task<ReadOnlyMemory<float>> GetEmbeddingsAsync(string text, CancellationToken ct = default)
    {
        var payload  = new { model = _options.EmbeddingModel, input = text };
        var response = await ExecuteWithRetryAsync(
            () => _voyageClient.PostAsJsonAsync("/v1/embeddings", payload, JsonOpts, ct));

        await EnsureSuccessAsync(response, ct);

        using var doc = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);

        var data   = doc.RootElement.GetProperty("data")[0].GetProperty("embedding");
        var floats = new float[data.GetArrayLength()];
        int i      = 0;
        foreach (var val in data.EnumerateArray())
            floats[i++] = val.GetSingle();

        return floats.AsMemory();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Throws with the full Anthropic error body so the caller can see exactly what went wrong
    /// instead of a generic "400 Bad Request".
    /// </summary>
    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode) return;

        var body = await response.Content.ReadAsStringAsync(ct);
        throw new HttpRequestException(
            $"Anthropic API error {(int)response.StatusCode} ({response.ReasonPhrase}): {body}",
            null,
            response.StatusCode);
    }

    private static async Task<HttpResponseMessage> ExecuteWithRetryAsync(
        Func<Task<HttpResponseMessage>> call)
    {
        HttpResponseMessage response = null!;
        for (int attempt = 0; attempt < 3; attempt++)
        {
            response = await call();
            if (response.StatusCode != HttpStatusCode.TooManyRequests)
                break;
            await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt)));
        }
        return response;
    }
}
