namespace AgentPM.Domain.Interfaces;

public interface ILLMClient
{
    Task<string> GenerateAsync(string systemPrompt, string userPrompt, LLMSettings settings);
    Task<ReadOnlyMemory<float>> GetEmbeddingsAsync(string text);
}
