from __future__ import annotations

from typing import Optional


class AdapterError(Exception):
    """Base exception for all adapter errors."""

    def __init__(self, message: str, provider: Optional[str] = None):
        self.provider = provider
        super().__init__(message)


class AuthenticationError(AdapterError):
    """Raised when credentials are invalid or expired."""
    pass


class RateLimitError(AdapterError):
    """Raised when the provider's rate limit is hit."""

    def __init__(
        self,
        message: str,
        retry_after: Optional[int] = None,
        provider: Optional[str] = None,
    ):
        self.retry_after = retry_after
        super().__init__(message, provider)


class TicketNotFoundError(AdapterError):
    """Raised when a requested ticket doesn't exist."""

    def __init__(self, ticket_id: str, provider: Optional[str] = None):
        self.ticket_id = ticket_id
        super().__init__(f"Ticket not found: {ticket_id}", provider)


class ProviderUnavailableError(AdapterError):
    """Raised when the provider API is down or unreachable."""
    pass


class BlockerNotFoundError(AdapterError):
    """Raised when a requested blocker doesn't exist."""

    def __init__(self, blocker_id: str, provider: Optional[str] = None):
        self.blocker_id = blocker_id
        super().__init__(f"Blocker not found: {blocker_id}", provider)
