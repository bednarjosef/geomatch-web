import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // 1. Grab the top_k parameter from the frontend's request (defaults to 30)
    const { searchParams } = new URL(request.url);
    const topK = searchParams.get('top_k') || '30';

    // 2. Extract the raw FormData (the image) sent by the browser
    const formData = await request.formData();

    // 3. Define your VPS destination (Make sure to set this in Vercel's Environment Variables later!)
    const VPS_URL = process.env.VPS_API_URL || "http://46.224.67.64:1717";

    // 4. Forward the request to your FastAPI server
    const backendResponse = await fetch(`${VPS_URL}/query?top_k=${topK}`, {
      method: 'POST',
      body: formData,
      // Note: We deliberately DO NOT set a 'Content-Type' header here.
      // Next.js/Node will automatically generate the correct multipart boundary for us.
    });

    // 5. Handle VPS errors gracefully
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error("VPS Backend Error:", backendResponse.status, errorText);
      return NextResponse.json(
        { detail: `Target Server Error: ${backendResponse.status}` }, 
        { status: backendResponse.status }
      );
    }

    // 6. Return the successful JSON back to the frontend
    const data = await backendResponse.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('API Route Proxy Error:', error);
    return NextResponse.json(
      { detail: 'Internal Server Proxy Error' }, 
      { status: 500 }
    );
  }
}
