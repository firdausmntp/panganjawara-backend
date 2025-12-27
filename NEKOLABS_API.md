# NekoLabs API - CORS Bypass Routes

API ini menyediakan endpoint untuk bypass CORS menggunakan NekoLabs API gratis.

## Base URL
```
http://localhost:3000/pajar/nekolabs
```

## Endpoints

### 1. CORS Proxy (Image Bypass)

Endpoint ini mem-proxy gambar dari URL manapun untuk bypass CORS restrictions.

```bash
GET /nekolabs/cors?url=IMAGE_URL
```

**Query Parameters:**
- `url` (required) - Full URL gambar yang ingin di-proxy

**Example Request:**
```bash
# Proxy gambar dari NekoLabs
curl -X GET "http://localhost:3000/pajar/nekolabs/cors?url=https://api.nekolabs.web.id/f/nekoo_1764226556840.png"
```

**Response:**
- Langsung return binary image dengan proper Content-Type header
- Cache: 24 jam
- CORS: Enabled (Access-Control-Allow-Origin: *)

**Use Case - Generate + Proxy:**
```javascript
// Step 1: Generate image
const genResponse = await fetch(
  'http://localhost:3000/pajar/nekolabs/image?prompt=Beautiful+sunset&ratio=16:9'
);
const genData = await genResponse.json();

// Step 2: Proxy the result to bypass CORS
const proxiedUrl = `http://localhost:3000/pajar/nekolabs/cors?url=${encodeURIComponent(genData.result)}`;

// Step 3: Use in your HTML
document.getElementById('myImage').src = proxiedUrl;
```

**HTML Example:**
```html
<!-- Direct use in img tag -->
<img src="http://localhost:3000/pajar/nekolabs/cors?url=https://api.nekolabs.web.id/f/nekoo_1764226556840.png" 
     alt="Generated Image" />
```

---

### 2. Image Generation


#### Imagen 4.0 (Recommended)
```bash
GET /nekolabs/image?prompt=YOUR_PROMPT&ratio=1:1&version=4.0
```

#### Imagen 3.0
```bash
GET /nekolabs/image?prompt=YOUR_PROMPT&ratio=16:9&version=3.0
```

**Query Parameters:**
- `prompt` (required) - Deskripsi gambar yang ingin dibuat
- `ratio` (optional) - Rasio gambar: `1:1`, `16:9`, `3:4`, `4:3`, `9:16` (default: `1:1`)
- `version` (optional) - Versi API: `3.0` atau `4.0` (default: `4.0`)

**Example Request:**
```bash
curl -X GET "http://localhost:3000/pajar/nekolabs/image?prompt=A+grizzled+old+samurai+sitting+alone+in+a+rain-soaked+alley&ratio=16:9&version=4.0"
```

**Example Response:**
```json
{
  "success": true,
  "result": "https://api.nekolabs.web.id/f/nekoo_1764218677838.png",
  "timestamp": "2025-11-27T04:44:38.554Z",
  "responseTime": "6050ms"
}
```

---

### 3. Text Generation - Gemini 2.5 Flash (Simple)


```bash
GET /nekolabs/text/gemini?text=YOUR_TEXT&systemPrompt=SYSTEM_PROMPT&sessionId=SESSION_ID&version=v1
```

**Query Parameters:**
- `text` (required) - Input text untuk generate response
- `systemPrompt` (optional) - Instruksi untuk sistem AI
- `imageUrl` (optional) - URL gambar (recommended: tmpfiles.org)
- `sessionId` (optional) - ID unik untuk session (untuk context memory)
- `version` (optional) - Versi API: `v1` atau `v2` (default: `v1`)

**Example Request:**
```bash
curl -X GET "http://localhost:3000/pajar/nekolabs/text/gemini?text=Buatkan+artikel+tentang+pertanian&systemPrompt=Kamu+adalah+penulis+artikel+profesional&sessionId=user123"
```

**Example Response:**
```json
{
  "success": true,
  "result": "Berikut adalah artikel tentang pertanian...",
  "timestamp": "2025-11-27T04:52:05.524Z",
  "responseTime": "1588ms"
}
```

**Note:** Jika v1 error, coba gunakan `version=v2`

---

### 4. Chat Completion - Gemini v2 (Advanced)

Endpoint ini mendukung array messages untuk percakapan yang lebih kompleks.

```bash
POST /nekolabs/text/chat
```

**Body Parameters (JSON):**
- `messages` (required) - Array object pesan `[{role: "user", content: "..."}]`
- `model` (optional) - Model AI (default: `gemini-2.5-flash`)

**Example Request:**
```bash
curl -X POST "http://localhost:3000/pajar/nekolabs/text/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user", 
        "content": "Buatkan ringkasan singkat tentang cuaca hari ini di Tangerang"
      }
    ],
    "model": "gemini-2.5-flash"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "result": "Di Tangerang 📍, cuaca hari ini ☀️ cerah berawan...",
  "timestamp": "2025-11-27T06:58:55.663Z",
  "responseTime": "7314ms"
}
```

---

### 5. Text Generation - OpenAI O3


```bash
GET /nekolabs/text/openai?text=YOUR_TEXT&systemPrompt=SYSTEM_PROMPT&sessionId=SESSION_ID
```

**Query Parameters:**
- `text` (required) - Input text untuk generate response
- `systemPrompt` (optional) - Instruksi untuk sistem AI
- `imageUrl` (optional) - URL gambar (recommended: tmpfiles.org)
- `sessionId` (optional) - ID unik untuk session

**Example Request:**
```bash
curl -X GET "http://localhost:3000/pajar/nekolabs/text/openai?text=Siapa+kamu&systemPrompt=Kamu+adalah+asisten+AI"
```

**Example Response:**
```json
{
  "success": true,
  "result": "Halo, saya adalah asisten AI yang siap membantu Anda.",
  "timestamp": "2025-11-27T04:53:37.793Z",
  "responseTime": "4873ms"
}
```

---

## Error Responses

### 400 - Bad Request
```json
{
  "success": false,
  "error": "Parameter \"prompt\" diperlukan"
}
```

### 408 - Request Timeout
```json
{
  "success": false,
  "error": "Request timeout - gambar memerlukan waktu terlalu lama untuk dibuat"
}
```

### 429 - Too Many Requests
```json
{
  "success": false,
  "error": "Rate limit exceeded"
}
```

### 500 - Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Error details..."
}
```

---

## Use Cases

### 1. Generate Image untuk Artikel
```javascript
const response = await fetch(
  'http://localhost:3000/pajar/nekolabs/image?' + 
  new URLSearchParams({
    prompt: 'Beautiful rice field in Indonesia',
    ratio: '16:9',
    version: '4.0'
  })
);
const data = await response.json();
console.log('Image URL:', data.result);
```

### 2. Generate Narasi Artikel dengan Gemini
```javascript
const response = await fetch(
  'http://localhost:3000/pajar/nekolabs/text/gemini?' + 
  new URLSearchParams({
    text: 'Buatkan artikel tentang pangan lokal Indonesia',
    systemPrompt: 'Kamu adalah penulis artikel profesional tentang pertanian',
    sessionId: 'article-123'
  })
);
const data = await response.json();
console.log('Article:', data.result);
```

### 3. Generate dengan OpenAI O3
```javascript
const response = await fetch(
  'http://localhost:3000/pajar/nekolabs/text/openai?' + 
  new URLSearchParams({
    text: 'Jelaskan tentang pertanian organik',
    systemPrompt: 'Kamu adalah ahli pertanian'
  })
);
const data = await response.json();
console.log('Response:', data.result);
```

---

## Notes

1. **CORS**: Semua endpoint sudah support CORS, bisa dipanggil dari frontend
2. **Rate Limit**: API NekoLabs mungkin punya rate limit, gunakan dengan bijak
3. **Timeout**: Request timeout diset 30 detik
4. **Free API**: API ini gratis dari NekoLabs
5. **Session ID**: Gunakan sessionId yang sama untuk maintain context dalam conversation

---

## Integration Example (Frontend)

```html
<!DOCTYPE html>
<html>
<head>
    <title>NekoLabs API Test</title>
</head>
<body>
    <h1>Test NekoLabs API</h1>
    
    <!-- Image Generation -->
    <div>
        <h2>Generate Image</h2>
        <input type="text" id="imagePrompt" placeholder="Describe image...">
        <button onclick="generateImage()">Generate</button>
        <div id="imageResult"></div>
    </div>
    
    <!-- Text Generation -->
    <div>
        <h2>Generate Text (Gemini)</h2>
        <input type="text" id="textPrompt" placeholder="Your question...">
        <button onclick="generateText()">Generate</button>
        <div id="textResult"></div>
    </div>
    
    <script>
        const API_BASE = 'http://localhost:3000/pajar/nekolabs';
        
        async function generateImage() {
            const prompt = document.getElementById('imagePrompt').value;
            const response = await fetch(
                `${API_BASE}/image?prompt=${encodeURIComponent(prompt)}&ratio=16:9&version=4.0`
            );
            const data = await response.json();
            
            if (data.success) {
                // Use CORS proxy to display image
                const proxyUrl = `${API_BASE}/cors?url=${encodeURIComponent(data.result)}`;
                document.getElementById('imageResult').innerHTML = 
                    `<img src="${proxyUrl}" style="max-width: 500px;">`;
            }
        }
        
        async function generateText() {
            const prompt = document.getElementById('textPrompt').value;
            const response = await fetch(
                `${API_BASE}/text/gemini?text=${encodeURIComponent(prompt)}&systemPrompt=Kamu adalah asisten AI`
            );
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('textResult').innerText = data.result;
            }
        }
    </script>
</body>
</html>
```
