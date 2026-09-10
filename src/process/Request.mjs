import gRPC from "@nsnanocat/grpc";
import { Console } from "@nsnanocat/util";
import MD5 from "crypto-js/md5.js";
import { cacheAirborneRequest } from "../function/airborne.mjs";
import database from "../function/database.mjs";
import fixHeaders from "../function/fixHeaders.mjs";
import setENV from "../function/setENV.mjs";
/***************** Processing *****************/
export async function Request($request, KV) {
	// 构造回复数据
	let $response;
	// 解构URL
	const url = new URL($request.url);
	// 获取连接参数
	const PATHs = url.pathname.split("/").filter(Boolean);
	// 解析格式
	const FORMAT = ($request.headers?.["Content-Type"] ?? $request.headers?.["content-type"])?.split(";")?.[0];
	/**
	 * 设置
	 * @type {{Settings: import('./types').Settings}}
	 */
	const { Settings, Caches } = await setENV("BiliBili", "ADBlock", database, KV);
	// 原实现还会解构 Configs；当前流程暂未使用，保留下面的原结构供后续功能恢复。
	// const { Settings, Caches, Configs } = await setENV("BiliBili", "ADBlock", database, KV);
	Console.logLevel = Settings.LogLevel;
	// 重要：环境合并完成后才能输出分级日志，确保整次执行只使用 BoxJS 最终确定的日志等级。
	Console.info(`url: ${url.toJSON()}`);
	Console.info(`PATHs: ${PATHs}`);
	Console.info(`FORMAT: ${FORMAT}`);
	// 预留的通用响应结构，当前请求处理流程暂未使用。
	// const body = { code: 0, message: "0", data: {} };
	// 方法判断
	switch ($request.method) {
		case "POST":
		case "PUT":
		case "PATCH":
		// biome-ignore lint/suspicious/noFallthroughSwitchClause: inspect the request body before URL routing
		case "DELETE":
			// 格式判断
			switch (FORMAT) {
				case undefined: // 视为无body
					break;
				case "application/x-www-form-urlencoded":
				case "text/plain":
				default:
					break;
				case "application/x-mpegURL":
				case "application/x-mpegurl":
				case "application/vnd.apple.mpegurl":
				case "audio/mpegurl":
					//body = M3U8.parse($request.body);
					//Console.debug(`body: ${JSON.stringify(body)}`);
					//$request.body = M3U8.stringify(body);
					break;
				case "text/xml":
				case "text/html":
				case "text/plist":
				case "application/xml":
				case "application/plist":
				case "application/x-plist":
					//body = XML.parse($request.body);
					//Console.debug(`body: ${JSON.stringify(body)}`);
					//$request.body = XML.stringify(body);
					break;
				case "text/vtt":
				case "application/vtt":
					//body = VTT.parse($request.body);
					//Console.debug(`body: ${JSON.stringify(body)}`);
					//$request.body = VTT.stringify(body);
					break;
				case "text/json":
				case "application/json":
					//body = JSON.parse($request.body ?? "{}");
					//Console.debug(`body: ${JSON.stringify(body)}`);
					//$request.body = JSON.stringify(body);
					break;
				case "application/protobuf":
				case "application/x-protobuf":
				case "application/vnd.google.protobuf":
				case "application/grpc":
				case "application/grpc-web":
				case "application/grpc+proto":
				case "application/octet-stream": {
					//Console.debug(`$request.body: ${JSON.stringify($request.body)}`);
					//let rawBody = $app === "Quantumult X" ? new Uint8Array($request.bodyBytes ?? []) : ($request.body ?? new Uint8Array());
					//Console.debug(`isBuffer? ${ArrayBuffer.isView(rawBody)}: ${JSON.stringify(rawBody)}`);
					break;
				}
			}
		//break; // 不中断，继续处理URL
		case "GET":
		case "HEAD":
		case "OPTIONS":
		default:
			// 主机判断
			switch (url.hostname) {
				case "www.bilibili.com":
					break;
				case "search.bilibili.com":
					break;
				case "grpc.biliapi.net":
				case "app.biliapi.net":
				case "app.bilibili.com":
				case "app.biliapi.com":
					switch (url.pathname) {
						case "/bilibili.community.service.dm.v1.DM/DmSegMobile":
							switch (Settings?.DM?.Airborne) {
								case true: {
									cacheAirborneRequest($request);
									break;
								}
								case false:
								default:
									break;
							}
							break;
						case "/bilibili.app.interface.v1.Search/DefaultWords":
							$response = {
								status: 200,
								headers: fixHeaders($request.headers, {
									"Content-Type": "application/grpc",
									"Content-Length": "5",
								}),
								body: gRPC.encode(new Uint8Array()),
							};
							Console.info("✅ 搜索默认关键词已返回空 gRPC 响应");
							break;
						case "/x/v2/splash/show": // 开屏页
						case "/x/v2/splash/list": // 开屏页
						case "/x/v2/splash/brand/list": // 开屏页
						case "/x/v2/splash/event/list2": // 开屏页
							break;
						case "/x/v2/feed/index": // 推荐页
							switch (Settings?.Feed?.Activity) {
								case true:
								default:
									if (url.searchParams.has("banner_hash")) {
										// 无论如何此字段都为空，因为客户端无法收到（只要去了大图）
										if (url.searchParams.get("login_event") !== "0") {
											// 此字段可区分第一次请求和后续请求
											url.searchParams.delete("sign");
											url.searchParams.set("open_event", "");
											url.searchParams.set("pull", 0);
											if (Caches.banner_hash) {
												url.searchParams.set("banner_hash", Caches.banner_hash);
												Console.log("✅ 读取hash缓存成功");
											}
											const string = `${url.search.substring(1)}c2ed53a74eeefe3cf99fbd01d8c9c375`;
											const sign = MD5(string).toString();
											url.searchParams.set("sign", sign);
										}
									}
									break;
								case false:
									Console.warn("用户设置推荐页活动大图不去除");
									break;
							}
							break;
						case "/x/v2/feed/index/story": // 首页短视频流
							break;
						case "/x/v2/search/square": // 搜索页
							break;
						case "/x/v2/search": // 搜索-全部结果-api（综合）
						case "/x/v2/search/type": // 搜索-分类结果-api（番剧、用户、影视、专栏）
							break;
						case "/x/v2/space": // 用户空间
							break;
					}
					break;
				case "api.bilibili.com":
				case "api.biliapi.net":
					switch (url.pathname) {
						case "/pgc/page/bangumi": // 追番页
						case "/pgc/page/cinema/tab": // 观影页
							break;
						case "/x/player/wbi/playurl": // UGC-用户生产内容-播放地址
							break;
						case "/x/web-interface/wbi/index/top/feed/rcmd": // web首页
							break;
					}
					break;
				case "api.live.bilibili.com":
					switch (url.pathname) {
						case "/xlive/app-room/v1/index/getInfoByRoom": // 直播
							break;
					}
					break;
				case "cm.bilibili.com":
					switch (url.pathname) {
						case "/cm/api/conversion/mobile/v2":
							switch (true) {
								case Settings?.Privacy?.BlockBiliCommercial:
								case Settings?.Privacy?.Strict:
									$response = {
										status: 200,
										headers: { "Content-Type": "application/json; charset=utf-8" },
										body: JSON.stringify({ code: 0, message: "success" }),
									};
									Console.info("✅ B站商业转化上报已本地响应");
									break;
								default:
									break;
							}
							break;
						case "/cm/api/fees/wise":
							switch (true) {
								case Settings?.Privacy?.BlockBiliCommercial:
								case Settings?.Privacy?.Strict:
									$response = {
										status: 200,
										headers: { "Content-Type": "application/json; charset=utf-8" },
										body: JSON.stringify({ code: 0 }),
									};
									Console.info("✅ B站商业曝光上报已本地响应");
									break;
								default:
									break;
							}
							break;
					}
					break;
				case "adtrack.qianwen.com":
					switch (true) {
						case Settings?.Privacy?.BlockThirdParty:
						case Settings?.Privacy?.Strict:
							switch (true) {
								case /^\/v3\/ad\/(?:show\/)?bilibili$/.test(url.pathname):
									$response = {
										status: 200,
										headers: { "Content-Type": "text/plain; charset=utf-8" },
										body: "",
									};
									Console.info("✅ 千问广告归因请求已本地响应");
									break;
								default:
									break;
							}
							break;
						default:
							break;
					}
					break;
				case "tkio-redirect.solar-engine.com":
					switch (true) {
						case Settings?.Privacy?.BlockThirdParty:
						case Settings?.Privacy?.Strict:
							switch (true) {
								case url.pathname.startsWith("/receive/turl/"):
									$response = {
										status: 200,
										headers: { "Content-Type": "application/json; charset=utf-8" },
										body: JSON.stringify({ status: 0 }),
									};
									Console.info("✅ Solar Engine广告归因请求已本地响应");
									break;
								default:
									break;
							}
							break;
						default:
							break;
					}
					break;
			}
			break;
		case "CONNECT":
		case "TRACE":
			break;
	}
	$request.url = url.toString();
	Console.debug(`$request.url: ${$request.url}`);
	return { $request, $response };
}
