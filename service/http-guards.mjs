// Bounded, short-lived admission only. Forwarded headers are deliberately ignored.
export function clientThrottle({
  now = Date.now,
  maximum = 60,
  windowMs = 60000,
  capacity = 10000
} = {}) {
  const clients = new Map();
  return (req) => {
    const time = now();
    for (const [key, value] of clients) if (value.expires <= time) clients.delete(key);
    const key = req.socket.remoteAddress;
    if (!clients.has(key)) {
      if (clients.size >= capacity) return false;
      clients.set(key, { count: 0, expires: time + windowMs });
    }
    return ++clients.get(key).count <= maximum;
  };
}

// Absolute body deadline, including clients that keep trickling bytes.
export function readJson(req, { maximum = 8192, timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    const finish = (error, value) => {
      clearTimeout(timer);
      req.off('data', data);
      req.off('end', end);
      req.off('error', failed);
      req.off('aborted', aborted);
      if (error) {
        req.pause();
        reject(error);
      } else resolve(value);
    };
    const data = (chunk) => {
      length += chunk.length;
      if (length > maximum) finish(Object.assign(Error('Request too large'), { status: 413 }));
      else chunks.push(chunk);
    };
    const end = () => {
      try {
        finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        finish(Object.assign(Error('Invalid JSON'), { status: 400 }));
      }
    };
    const failed = (error) => finish(error);
    const aborted = () => finish(Error('Request aborted'));
    const timer = setTimeout(
      () => finish(Object.assign(Error('Request body timeout'), { status: 408 })),
      timeoutMs
    );
    timer.unref();
    if (Number(req.headers['content-length']) > maximum) {
      finish(Object.assign(Error('Request too large'), { status: 413 }));
      return;
    }
    req.on('data', data);
    req.once('end', end);
    req.once('error', failed);
    req.once('aborted', aborted);
  });
}

export function rejectBody(req, res) {
  // Close after the error response is flushed; never retain an unread request body.
  res.setHeader('Connection', 'close');
  res.once('finish', () => req.destroy());
}
