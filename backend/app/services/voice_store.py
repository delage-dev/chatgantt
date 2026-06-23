"""Voice session state store.

The Twilio telephony path (caller/PIN mappings, OpenAI credential config) has
been retired in favor of a telephony-free LiveKit voice agent. Voice session
config (Notion token, project/blockers data-source IDs) now travels in the
minted LiveKit JWT as participant attributes — see
``app/routers/voice.py::mint_voice_token`` — so no server-side state is kept.

This module is intentionally empty; it remains as a placeholder in case
process-lifetime voice state is needed again.
"""
from __future__ import annotations
