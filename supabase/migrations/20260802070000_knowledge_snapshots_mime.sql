-- knowledge-snapshots: アップロード Content-Type との MIME 不一致を解消
-- アプリは text/plain で送る。既存バケットに charset 付きも許容しておく。

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'text/plain',
    'text/plain; charset=utf-8',
    'application/octet-stream'
  ]::text[],
  public = false,
  file_size_limit = 4194304
WHERE id = 'knowledge-snapshots';
