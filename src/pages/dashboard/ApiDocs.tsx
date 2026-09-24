import { useState } from 'react';
import { Code2, Copy, Check, Camera, Server, Key } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export default function ApiDocs() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const endpoint = `${supabaseUrl}/functions/v1/esp32cam-upload`;

  const arduinoCode = `#include <WiFi.h>
#include <HTTPClient.h>
#include <base64.h>

const char* WIFI_SSID = "your_wifi";
const char* WIFI_PASS = "your_password";
const char* SERVER_URL = "${endpoint}";
const char* API_KEY = "your_api_key_here";

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi connected!");
}

void sendPhoto(camera_fb_t* fb) {
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  // Convert image to base64
  String base64Image = base64::encode(fb->buf, fb->len);

  String payload = "{\\"image\\":\\"" + base64Image + "\\"," 
    "\\"device_id\\":\\"ESP32CAM_01\\"}";

  int response = http.POST(payload);
  String responseStr = http.getString();

  Serial.print("Response code: ");
  Serial.println(response);
  Serial.print("Response: ");
  Serial.println(responseStr);

  http.end();
}`;

  const curlCode = `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image": "BASE64_ENCODED_IMAGE_DATA",
    "device_id": "ESP32CAM_01"
  }'`;

  const responseExample = `{
  "success": true,
  "matched": true,
  "student": {
    "id": "uuid-here",
    "full_name": "Juan Dela Cruz",
    "student_id": "2024-00123"
  },
  "confidence": 0.87,
  "image_url": "https://..."
}`;

  const codeBlock = (code: string, language: string, id: string) => (
    <div className="relative">
      <button
        onClick={() => copy(code, id)}
        className="absolute top-3 right-3 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition"
      >
        {copied === id ? (
          <Check className="w-4 h-4 text-emerald-400" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
      <pre className="bg-slate-950 rounded-xl border border-slate-800 p-4 pr-14 overflow-x-auto text-sm text-slate-300 font-mono leading-relaxed">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
            <Code2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">API Documentation</h1>
            <p className="text-sm text-slate-400">ESP32-CAM integration guide</p>
          </div>
        </div>
      </div>

      {/* Overview */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Server className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">API Endpoint</h2>
        </div>
        <p className="text-sm text-slate-400 mb-3">
          Send a base64-encoded image from your ESP32-CAM to this endpoint. The server will extract
          facial landmarks, match against enrolled students, and return the result.
        </p>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
          <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">POST</span>
          <code className="text-sm text-slate-300 font-mono flex-1 break-all">{endpoint}</code>
          <button
            onClick={() => copy(endpoint, 'endpoint')}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex-shrink-0"
          >
            {copied === 'endpoint' ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Authentication */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Authentication</h2>
        </div>
        <p className="text-sm text-slate-400 mb-3">
          Include your API key in the Authorization header. You can find your API key in the Supabase
          project settings under API Keys (the anon key).
        </p>
        <code className="block bg-slate-950 rounded-lg border border-slate-800 p-3 text-sm text-slate-300 font-mono">
          Authorization: Bearer YOUR_ANON_KEY
        </code>
      </div>

      {/* Request format */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Request Body</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Field</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Type</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Required</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr>
                <td className="py-2 px-3 text-white font-mono">image</td>
                <td className="py-2 px-3 text-slate-400">string (base64)</td>
                <td className="py-2 px-3 text-emerald-400">Yes</td>
                <td className="py-2 px-3 text-slate-400">Base64-encoded JPEG image from ESP32-CAM</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-white font-mono">device_id</td>
                <td className="py-2 px-3 text-slate-400">string</td>
                <td className="py-2 px-3 text-slate-500">No</td>
                <td className="py-2 px-3 text-slate-400">Identifier for the ESP32-CAM device</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Response format */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Response Format</h2>
        {codeBlock(responseExample, 'json', 'response')}
      </div>

      {/* cURL example */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">cURL Example</h2>
        {codeBlock(curlCode, 'bash', 'curl')}
      </div>

      {/* Arduino code */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Camera className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">ESP32-CAM Arduino Code</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Use this code on your ESP32-CAM to capture and send images to the API:
        </p>
        {codeBlock(arduinoCode, 'cpp', 'arduino')}
      </div>

      {/* Note */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-blue-400 mb-2">How Face Matching Works</h3>
        <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
          <li>ESP32-CAM captures an image and sends it as base64 to the API</li>
          <li>The server decodes the image and extracts 68 facial landmarks + a 128-value face descriptor</li>
          <li>The descriptor is compared against all enrolled student descriptors using Euclidean distance</li>
          <li>If the distance is below threshold (0.6), the match is returned with a confidence score</li>
          <li>The result and image are logged to the recognition_logs table</li>
        </ol>
      </div>
    </div>
  );
}
