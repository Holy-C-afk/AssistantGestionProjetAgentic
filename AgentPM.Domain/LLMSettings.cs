namespace AgentPM.Domain;

public record LLMSettings(
    string Model = "claude-opus-4-5",
    float Temperature = 0.7f,
    int MaxTokens = 2048
);
