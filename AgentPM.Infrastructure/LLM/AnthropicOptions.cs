namespace AgentPM.Infrastructure.LLM;

public class AnthropicOptions
{
    public string ApiKey { get; set; } = string.Empty;
    public string VoyageApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.anthropic.com";
    public string EmbeddingModel { get; set; } = "voyage-large-2";
}
