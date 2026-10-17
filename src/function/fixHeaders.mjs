import { Console } from "@nsnanocat/util";

/**
 * 用于修复 content-type: application/grpc 的响应头
 * Fix response headers for content-type: application/grpc.
 * @author VirgilClyne
 * @param {Object} requestHeaders 请求头 / Request headers.
 * @param {Object} responseHeaders 响应头 / Response headers.
 * @returns {Object} 修复后的响应头 / Corrected response headers.
 */
export default function fixHeaders(requestHeaders, responseHeaders) {
	Console.log("☑️ Fix Headers");
	const ua = String(requestHeaders["User-Agent"] ?? requestHeaders["user-agent"] ?? "");
	switch (true) {
		// 粉B：请求头中存在x-bili-moss-engine-type: 1的，响应头必须有grpc-status: 0。否则有没有都不影响
		// Universal clients require grpc-status: 0 when x-bili-moss-engine-type: 1 is present; otherwise the status header is optional.
		case ua.startsWith("bili-universal/"):
		case ua.includes("bili-universal/"):
		case ua.startsWith("bili-hd2/"):
		case ua.includes("bili-hd2/"):
		case ua.startsWith("bili-overseas/"):
		case ua.includes("bili-overseas/"):
			if (requestHeaders["x-bili-moss-engine-type"] === "1" && responseHeaders["grpc-status"] === undefined) responseHeaders["grpc-status"] ??= "0";
			if (requestHeaders["X-Bili-Moss-Engine-Type"] === "1" && responseHeaders["Grpc-Status"] === undefined) responseHeaders["Grpc-Status"] ??= "0";
			break;
		// 白B：不能有grpc-status: 0
		// International clients must not include grpc-status: 0.
		case ua.startsWith("bili-inter/"):
		case ua.includes("bili-inter/"):
			if (responseHeaders["grpc-status"] === "0") delete responseHeaders["grpc-status"];
			if (responseHeaders["Grpc-Status"] === "0") delete responseHeaders["Grpc-Status"];
			break;
		// 蓝B：必须有grpc-status: 0
		// Blue clients must include grpc-status: 0.
		case ua.startsWith("bili-blue/"):
		case ua.includes("bili-blue/"):
			if (responseHeaders["grpc-status"] === undefined) responseHeaders["grpc-status"] ??= "0";
			if (responseHeaders["Grpc-Status"] === undefined) responseHeaders["Grpc-Status"] ??= "0";
			break;
	}

	Console.log("✅ Fix Headers");
	return responseHeaders;
}
