namespace MiningHelper;

// Exception that's okay to show to the user
public class UserException : Exception
{
    public string UserMessage;
    public UserException(string userMessage) : base(userMessage)
    {
        UserMessage = userMessage;
    }
}