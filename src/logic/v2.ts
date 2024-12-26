import { getUrl } from "../utils/index.js";

const m3u8ContentTypes: string[] = [
  "application/vnd.",
  "video/mp2t",
  "application/x-mpegurl",
  "application/mpegurl",
  "application/x-mpegurl",
  "application/vnd.apple.mpegurl",
  "audio/mpegurl",
  "audio/x-mpegurl",
  "video/x-mpegurl",
  "application/vnd.apple.mpegurl.audio",
  "application/vnd.apple.mpegurl.video",
];

export const M3u8ProxyV2 = async (
  request: Request<unknown>
): Promise<Response> => {
  const url = new URL(request.url);

  const scrapeUrlString = url.searchParams.get("url");
  const scrapeHeadersString = url.searchParams.get("headers");

  let scrapeHeadersObject: ScrapeHeaders = null;
  if (scrapeHeadersString) {
    try {
      scrapeHeadersObject = JSON.parse(scrapeHeadersString);
    } catch (e) {
      console.log(e);
      console.log(
        "[M3u8 Proxy V2] Malformed scrape headers, could no parse using DEFAULT headers"
      );
      scrapeHeadersObject = null;
    }
  }

  if (!scrapeUrlString) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "no scrape url provided",
      }),
      {
        status: 400,
      }
    );
  }

  const scrapeUrl = new URL(scrapeUrlString);
  const headers: {
    [key: string]: string;
  } = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...(typeof scrapeHeadersObject == "object" ? scrapeHeadersObject : {}),
  };

  const rangeHeader = request.headers.get("Range");
  if (rangeHeader) {
    headers["Range"] = rangeHeader;
  }

  const response = await fetch(scrapeUrlString, {
    headers: headers,
  });

  // get the content type of the response
  const responseContentType = response.headers
    .get("Content-Type")
    ?.toLowerCase();
  let responseBody: BodyInit | null = response.body;

  const isM3u8 =
    scrapeUrl.pathname.endsWith(".m3u8") ||
    (responseContentType &&
      m3u8ContentTypes.some((name) => responseContentType.includes(name)));

  console.log(`Is m3u8: ${isM3u8}`);

  if (isM3u8) {
    const m3u8File = await response.text();
    const m3u8FileChunks = m3u8File.split("\n");
    const m3u8AdjustedChunks: string[] = [];
    for (const line of m3u8FileChunks) {
      // lines that start with #'s are non data lines (they hold info like bitrate and other stuff)
      if (line.startsWith("#") || !line.trim()) {
        if (line.startsWith('#EXT-X-MAP:URI="')) {
          const url = getUrl(
            line.replace('#EXT-X-MAP:URI="', "").replace('"', ""),
            scrapeUrl
          );
          const searchParams = new URLSearchParams();
          searchParams.set("url", url.toString());
          if (scrapeHeadersString)
            searchParams.set("headers", scrapeHeadersString);

          m3u8AdjustedChunks.push(
            `#EXT-X-MAP:URI="/v2?${searchParams.toString()}"`
          );
        } else {
          m3u8AdjustedChunks.push(line);
        }
        continue;
      }

      const url = getUrl(line, scrapeUrl);
      const searchParams = new URLSearchParams();

      searchParams.set("url", url.toString());
      if (scrapeHeadersString) searchParams.set("headers", scrapeHeadersString);

      m3u8AdjustedChunks.push(`/v2?${searchParams.toString()}`);
    }

    responseBody = m3u8AdjustedChunks.join("\n");
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");

  return new Response(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};

type ScrapeHeaders =
  | string
  | null
  | {
      [key: string]: string;
    };
