from fastapi import HTTPException


class BodySizeLimitMiddleware:
    """Bound streamed bodies before multipart uploads can fill temporary storage."""

    def __init__(self, app, max_bytes):
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        consumed = 0

        async def limited_receive():
            nonlocal consumed
            message = await receive()
            if message["type"] == "http.request":
                consumed += len(message.get("body", b""))
                if consumed > self.max_bytes:
                    raise HTTPException(413, "Upload exceeds the file-size limit")
            return message

        await self.app(scope, limited_receive, send)
