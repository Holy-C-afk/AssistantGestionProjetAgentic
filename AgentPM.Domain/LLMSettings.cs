namespace AgentPM.Domain;

public record LLMSettings(
    string Model = "claude-sonnet-4-6",
    float Temperature = 0.7f,
    int MaxTokens = 2048
);
