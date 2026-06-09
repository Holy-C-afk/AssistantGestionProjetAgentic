namespace AgentPM.Domain;

public record LLMSettings(
    string Model = "claude-haiku-4-5-20251001",
    float Temperature = 0.7f,
    int MaxTokens = 2048
);
