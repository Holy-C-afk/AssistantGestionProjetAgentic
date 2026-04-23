using System.Net;
using System.Net.Http.Json;
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

    public async Task<string> GenerateAsync(string systemPrompt, string userPrompt, LLMSettings settings)
    {
        var payload = new
        {
            model = settings.Model,
            max_tokens = settings.MaxTokens,
            system = systemPrompt,
            messages = new[] { new { role = "user", content = userPrompt } }
        };

        var response = await ExecuteWithRetryAsync(() =>
            _httpClient.PostAsJsonAsync("/v1/messages", payload, JsonOpts));

        response.EnsureSuccessStatusCode();

        using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        return doc.RootElement
            .GetProperty("content")[0]
            .GetProperty("text")
            .GetString() ?? string.Empty;
    }

    public async Task<ReadOnlyMemory<float>> GetEmbeddingsAsync(string text)
    {
        var payload = new { model = _options.EmbeddingModel, input = text };

        var response = await ExecuteWithRetryAsync(() =>
            _voyageClient.PostAsJsonAsync("/v1/embeddings", payload, JsonOpts));

        response.EnsureSuccessStatusCode();

        using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var data = doc.RootElement.GetProperty("data")[0].GetProperty("embedding");

        var floats = new float[data.GetArrayLength()];
        int i = 0;
        foreach (var val in data.EnumerateArray())
            floats[i++] = val.GetSingle();

        return floats.AsMemory();
    }

    private static async Task<HttpResponseMessage> ExecuteWithRetryAsync(Func<Task<HttpResponseMessage>> call)
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
