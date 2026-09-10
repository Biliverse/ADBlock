import gRPC from "@nsnanocat/grpc";
import { Console, fetch, Storage } from "@nsnanocat/util";
import ADBlock from "../class/ADBlock.mjs";
import { getAirborneDanmaku, takeAirborneRequest } from "../function/airborne.mjs";
import database from "../function/database.mjs";
import fixHeaders from "../function/fixHeaders.mjs";
import setENV from "../function/setENV.mjs";
import { DynAllPersonalReply, DynAllReply, DynVideoPersonalReply, DynVideoReply } from "../protobuf/bilibili/app/dynamic/v2/dynamic.js";
import { ModeStatusReply } from "../protobuf/bilibili/app/interface/teenagers.js";
import { FragmentType, PlayViewUniteReply } from "../protobuf/bilibili/app/playerunite/v1/playerunite.js";
import { PlayViewReply } from "../protobuf/bilibili/app/playurl/v1/playurl.js";
import { PlayerRelatesReply, TFInfoReply, ViewProgressReply, RelatesFeedReply as ViewRelatesFeedReply, ViewReply } from "../protobuf/bilibili/app/view/v1/view.js";
import { ViewProgressReply as ViewUniteProgressReply } from "../protobuf/bilibili/app/viewunite/v1/viewprogress.js";
import { RelatesFeedReply, ViewReply as ViewUniteReply } from "../protobuf/bilibili/app/viewunite/v1/viewunite.js";
import { DmColorfulType, DmSegMobileReply, DmViewReply } from "../protobuf/bilibili/community/service/dm/v1/dm.js";
import { DetailListReply, MainListReply, ReplyInfoReply } from "../protobuf/bilibili/main/community/reply/v1/reply.js";
import { SubjectDescriptionReply } from "../protobuf/bilibili/main/community/reply/v2/reply.js";
import { PlayViewReply as PGCPlayViewReply } from "../protobuf/bilibili/pgc/gateway/player/v2/playurl.js";
import { SearchAllResponse } from "../protobuf/bilibili/polymer/app/search/v1/search.js";
/***************** Processing *****************/
export async function Response($request, $response, KV) {
	// 解构URL
	const url = new URL($request.url);
	// 获取连接参数
	const PATHs = url.pathname.split("/").filter(Boolean);
	// 解析格式
	const FORMAT = ($response.headers?.["Content-Type"] ?? $response.headers?.["content-type"])?.split(";")?.[0];
	/**
	 * 设置
	 * @type {{Settings: import('./types').Settings}}
	 */
	const { Settings, Caches } = await setENV("BiliBili", "ADBlock", database, KV);
	// 原实现还会解构 Configs；当前流程暂未使用，保留下面的原结构供后续功能恢复。
	// const { Settings, Caches, Configs } = await setENV("BiliBili", "ADBlock", database, KV);
	const adBlock = new ADBlock();
	Console.logLevel = Settings.LogLevel;
	// 重要：环境合并完成后才能输出分级日志，确保整次执行只使用 BoxJS 最终确定的日志等级。
	Console.info(`url: ${url.toJSON()}`);
	Console.info(`PATHs: ${PATHs}`);
	Console.info(`FORMAT: ${FORMAT}`);
	// 创建空数据
	let body = { code: 0, message: "0", data: {} };
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
			//body = M3U8.parse($response.body);
			//Console.debug(`body: ${JSON.stringify(body)}`);
			//$response.body = M3U8.stringify(body);
			break;
		case "text/xml":
		case "text/html":
		case "text/plist":
		case "application/xml":
		case "application/plist":
		case "application/x-plist":
			//body = XML.parse($response.body);
			//Console.debug(`body: ${JSON.stringify(body)}`);
			//$response.body = XML.stringify(body);
			break;
		case "text/vtt":
		case "application/vtt":
			//body = VTT.parse($response.body);
			//Console.debug(`body: ${JSON.stringify(body)}`);
			//$response.body = VTT.stringify(body);
			break;
		case "text/json":
		case "application/json": {
			body = JSON.parse($response.body ?? "{}");
			// 解析链接
			switch (url.hostname) {
				case "www.bilibili.com":
					break;
				case "app.bilibili.com":
				case "app.biliapi.net":
				case "app.biliapi.com": {
					switch (url.pathname) {
						case "/x/v2/splash/show": // 开屏页
						case "/x/v2/splash/list": // 开屏页
						case "/x/v2/splash/brand/list": // 开屏页
						case "/x/v2/splash/event/list2": // 开屏页
							switch (Settings?.Splash) {
								case true:
								default: {
									Console.info("✅ 开屏页广告去除");
									const item = ["account", "event_list", "preload", "show"];
									if (body?.data && typeof body.data === "object") {
										item.forEach(i => {
											delete body.data[i];
										});
									}
									break;
								}
								case false:
									Console.warn("用户设置开屏页广告不去除");
									break;
							}
							break;
						case "/x/v2/feed/index": // 推荐页
							switch (Settings?.Feed?.AD) {
								case true:
								default: {
									if (body?.code === 0 && Array.isArray(body?.data?.items) && body.data.items.length) {
										//区分pad与phone
										body.data.items = await Promise.all(
											body.data.items.map(async item => {
												if (!item || typeof item !== "object") return item;
												const { card_type: cardType, card_goto: cardGoto, goto: Goto } = item;
												if (cardType && cardGoto) {
													if (["banner_v8", "banner_ipad_v8"].includes(cardType) && cardGoto === "banner") {
														switch (Settings?.Feed?.Activity) {
															case true:
																Caches.banner_hash = item.hash;
																// 缓存 banner_hash；缺少该字段时会出现无法伪造的活动页。
																// Cache banner_hash; without it, an activity page that cannot be forged appears.
																if (KV) await KV.setItem("@BiliBili.ADBlock.Caches", Caches);
																else Storage.setItem("@BiliBili.ADBlock.Caches", Caches);
																Console.info("✅ 推荐页活动大图去除");
																return undefined;
															case false:
															default:
																if (Array.isArray(item.banner_item)) {
																	item.banner_item = item.banner_item.filter(i => {
																		if (i.type === "ad" || i.type === "ad_inline") {
																			Console.info("✅ 推荐页大图广告去除");
																			return false;
																		}
																		return true;
																	});
																}
																break;
														}
													} else if (["cm_v2", "cm_v1"].includes(cardType) && ["ad_web_s", "ad_av", "ad_web_gif"].includes(cardGoto)) {
														// ad_player大视频广告 ad_web_gif大gif广告 ad_web_s普通小广告 ad_av创作推广广告 ad_inline_3d  上方大的视频3d广告 ad_inline_eggs 上方大的视频广告 ad_inline_live 华为问界
														Console.info(`✅ ${cardGoto}广告去除`);
														if (url.searchParams.get("device") !== "phone") {
															return undefined; //pad直接去除
														} else {
															await fixPosition().then(result => (item = result)); //小广告补位
														}
													} else if (cardGoto === "live" && cardType === "small_cover_v9") {
														let BlockUpLiveList = Settings?.Feed?.BlockUpLiveList;
														if (typeof BlockUpLiveList === "number") {
															BlockUpLiveList = BlockUpLiveList.toString();
														}
														if (
															BlockUpLiveList?.split(",")
																.map(item => item.trim())
																.filter(Boolean)
																.includes(String(item?.args?.up_id))
														) {
															Console.info(`✅ 屏蔽Up主<${item?.args?.up_name}>直播推广`);
															await fixPosition().then(result => (item = result)); //小广告补位
														}
													} else if (cardType === "cm_v2" && ["ad_player", "ad_inline_3d", "ad_inline_eggs", "ad_inline_live"].includes(cardGoto)) {
														Console.info(`✅ ${cardGoto}广告去除`);
														return undefined; //大广告直接去除
													} else if (cardType === "small_cover_v10" && cardGoto === "game") {
														Console.info("✅ 游戏广告去除");
														if (url.searchParams.get("device") !== "phone") {
															return undefined; //pad直接去除
														} else {
															await fixPosition().then(result => (item = result)); //小广告补位
														}
													} else if (cardType === "cm_double_v9" && cardGoto === "ad_inline_av") {
														Console.info("✅ 大视频广告去除");
														return undefined; //大广告直接去除
													} else if (Goto === "vertical_av") {
														switch (Settings?.Feed?.Vertical) {
															case true:
																Console.info("✅ 竖屏视频去除");
																await fixPosition().then(result => (item = result)); //小视频补位
																break;
															case false:
															default:
																Console.warn("用户设置推荐页竖屏视频不去除");
																break;
														}
													}
												}
												if (adBlock.isFeedAd(item)) {
													Console.info(`✅ 推荐页兜底规则触发：卡片类型：${cardType ?? ""}-卡片av：${cardGoto ?? ""}/${Goto ?? ""}`);
													return undefined;
												}
												return item;
											}),
										);
										body.data.items = body.data.items.filter(fix => fix !== undefined);
									}
									async function fixPosition() {
										let itemsCache = KV ? await KV.getItem("@BiliBili.Index.Caches", []) : Storage.getItem("@BiliBili.Index.Caches", []);
										if (!Array.isArray(itemsCache)) itemsCache = [];
										let singleItem;
										if (itemsCache.length > 0) {
											singleItem = itemsCache.pop();
											Console.info("✅ 推荐页空缺位填充成功");
										} else {
											//重新获取填充位
											const myRequest = {
												url: $request.url,
												headers: $request.headers,
											};
											await fetch(myRequest).then(async response => {
												try {
													const body = JSON.parse(response.body || "{}");
													if (Array.isArray(body?.data?.items) && body.data.items.length) {
														body.data.items = body.data.items
															.map(item => {
																if (!item || typeof item !== "object" || adBlock.isFeedAd(item)) return undefined;
																const { card_type: cardType, card_goto: cardGoto, goto: Goto } = item;
																if (cardType && cardGoto) {
																	if (cardType === "banner_v8" && cardGoto === "banner") {
																		return undefined;
																	} else if (cardType === "cm_v2" && ["ad_web_s", "ad_av", "ad_web_gif", "ad_player", "ad_inline_3d", "ad_inline_eggs", "ad_inline_live"].includes(cardGoto)) {
																		return undefined;
																	} else if (cardType === "small_cover_v10" && cardGoto === "game") {
																		return undefined;
																	} else if (cardType === "cm_double_v9" && cardGoto === "ad_inline_av") {
																		return undefined;
																	} else if (cardType === "large_cover_v9" && cardGoto === "inline_av_v2") {
																		//补位不需要大视频
																		return undefined;
																	} else if (Goto === "vertical_av") {
																		//补位不需要竖屏视频
																		return undefined;
																	}
																}
																return item;
															})
															.filter(fix => fix !== undefined);
														if (KV) await KV.setItem("@BiliBili.Index.Caches", body.data.items);
														else Storage.setItem("@BiliBili.Index.Caches", body.data.items);
														Console.info("✅ 推荐页缓存数组补充成功");
													} else {
														Console.warn("访问推荐页尝试填补失败");
													}
												} catch (e) {
													Console.error(e, response);
												}
											});
											itemsCache = KV ? await KV.getItem("@BiliBili.Index.Caches", []) : Storage.getItem("@BiliBili.Index.Caches", []);
											if (!Array.isArray(itemsCache)) itemsCache = [];
											if (itemsCache.length > 0) {
												singleItem = itemsCache.pop();
												Console.info("✅ 推荐页空缺位填充成功");
											}
										}
										if (KV) await KV.setItem("@BiliBili.Index.Caches", itemsCache);
										else Storage.setItem("@BiliBili.Index.Caches", itemsCache);
										return singleItem;
									}
									break;
								}
								case false:
									Console.warn("用户设置推荐页广告不去除");
									break;
							}
							if ((Settings?.Privacy?.Tracking || Settings?.Privacy?.Strict) && Array.isArray(body?.data?.items)) {
								body.data.items.forEach(item => {
									adBlock.cleanTracking(item);
								});
							}
							break;
						case "/x/v2/feed/index/story": // 首页短视频流
						case "/x/v2/feed/index/relate/story":
							{
								// 首页短视频关联流
								const removeStoryCommercial = Settings?.Feed?.StoryCommercial;
								const removeStoryTracking = Settings?.Privacy?.Tracking || Settings?.Privacy?.Strict;
								switch (Settings?.Feed?.Story) {
									case true:
									default:
										if (Array.isArray(body?.data?.items)) {
											// vertical_live 直播内容
											// vertical_pgc 大会员专享
											Console.info("✅ 首页短视频流广告去除");
											body.data.items = body.data.items
												.filter(item => item && typeof item === "object" && !adBlock.isFeedAd(item) && !adBlock.isStoryAd(item))
												.map(item => {
													adBlock.cleanStoryItem(item, removeStoryCommercial, removeStoryTracking);
													return item;
												});
										}
										break;
									case false:
										Console.warn("用户设置首页短视频流广告不去除");
										if (Array.isArray(body?.data?.items)) {
											body.data.items.forEach(item => {
												adBlock.cleanStoryItem(item, removeStoryCommercial, removeStoryTracking);
											});
										}
										break;
								}
							}
							break;
						case "/x/v2/search/square": // 搜索页
							switch (Settings?.Search?.HotSearch) {
								case true:
								default:
									Console.info("✅ 搜索页热搜内容去除");
									if (Array.isArray(body?.data)) body.data = body.data.filter(item => !adBlock.isHotSearchItem(item));
									break;
								case false:
									Console.warn("用户设置搜索页热搜内容不去除");
									break;
							}
							break;
					}
					break;
				}
				case "api.bilibili.com":
				case "api.biliapi.net":
					switch (url.pathname) {
						case "/x/vip/ads/materials": // 播放页广告素材
							if (Settings?.View?.AD !== false) {
								body = { code: -404, message: "-404", ttl: 1, data: null };
								Console.info("✅ 播放页广告素材去除");
							} else Console.warn("用户设置播放页广告素材不去除");
							break;
						case "/pgc/page/bangumi": // 追番页
						case "/pgc/page/cinema/tab": // 观影页
							switch (Settings?.PGC?.AD) {
								case true:
								default:
									if (body.result?.modules) {
										Console.info("✅ 观影页广告去除");
										body.result.modules.forEach(i => {
											if (i.style.startsWith("banner")) {
												i.items = i.items.filter(j => j.link.includes("play"));
											} else if (i.style.startsWith("function")) {
												i.items = i.items.filter(j => j.blink.startsWith("bilibili"));
											} else if ([241, 1283, 1284, 1441].includes(i.module_id)) {
												i.items = [];
											} else if (i.style.startsWith("tip")) {
												i.items = [];
											}
										});
									}
									break;
								case false:
									Console.warn("用户设置观影页广告不去除");
									break;
							}
							break;
						case "/x/player/wbi/playurl": // UGC-用户生产内容-播放地址
							break;
						case "/x/web-interface/wbi/index/top/feed/rcmd": // web首页
							switch (Settings?.Feed?.AD) {
								case true:
								default:
									Console.info("✅ 首页广告内容去除");
									if (Array.isArray(body?.data?.item)) body.data.item = body.data.item.filter(i => !(i.goto === "ad"));
									break;
								case false:
									Console.warn("用户设置首页广告不去除");
									break;
							}
							break;
					}
					break;
				case "api.live.bilibili.com":
					switch (url.pathname) {
						case "/xlive/app-interface/v2/index/feed": {
							// 直播首页推荐
							const removeTracking = Settings?.Privacy?.Tracking || Settings?.Privacy?.Strict;
							const removeCallbacks = Settings?.Xlive?.RemoveTrackingCallbacks || Settings?.Privacy?.Strict;
							const removePreloadTracking = Settings?.Xlive?.RemovePreloadTracking;
							if (Array.isArray(body?.data?.card_list)) {
								body.data.card_list = body.data.card_list.filter(item => {
									const cardData = item?.card_data;
									const liveCard = cardData?.small_card_v1;
									if (Settings?.Xlive?.AD && adBlock.isLiveCardAd(liveCard)) {
										Console.info("✅ 直播首页广告卡片去除");
										return false;
									}
									if (removeTracking || removeCallbacks || removePreloadTracking) {
										adBlock.cleanLiveCard(liveCard, removeTracking, removeCallbacks, removePreloadTracking);
										for (const section of Object.values(cardData ?? {})) {
											for (const card of Array.isArray(section?.list) ? section.list : []) adBlock.cleanLiveCard(card, removeTracking, removeCallbacks, removePreloadTracking);
										}
									}
									return true;
								});
							}
							break;
						}
						case "/xlive/app-interface/v2/room/recList": {
							// 直播间推荐
							const removeTracking = Settings?.Privacy?.Tracking || Settings?.Privacy?.Strict;
							const removeCallbacks = Settings?.Xlive?.RemoveTrackingCallbacks || Settings?.Privacy?.Strict;
							const removePreloadTracking = Settings?.Xlive?.RemovePreloadTracking;
							if (Array.isArray(body?.data?.list)) {
								if (Settings?.Xlive?.AD) body.data.list = body.data.list.filter(item => !adBlock.isLiveCardAd(item));
								if (removeTracking || removeCallbacks || removePreloadTracking) {
									body.data.list.forEach(card => {
										adBlock.cleanLiveCard(card, removeTracking, removeCallbacks, removePreloadTracking);
									});
								}
							}
							break;
						}
						case "/xlive/app-room/v1/index/getInfoByRoom": // 直播
							switch (Settings?.Xlive?.AD) {
								case true:
								default:
									Console.info("✅ 直播banner广告去除");
									if (body.data) Reflect.deleteProperty(body.data, "activity_banner_info");
									if (body.data?.shopping_info) {
										body.data.shopping_info = {
											is_show: 0,
										};
										Console.info("✅ 直播购物广告去除");
									}
									if (body.data?.new_tab_info?.outer_list?.length > 0) {
										body.data.new_tab_info.outer_list = body.data.new_tab_info.outer_list.filter(i => i.biz_id !== 33);
									}
									break;
								case false:
									Console.warn("用户设置直播页广告不去除");
									break;
							}
							break;
					}
					break;
			}
			$response.body = JSON.stringify(body);
			break;
		}
		case "application/protobuf":
		case "application/x-protobuf":
		case "application/vnd.google.protobuf":
		case "application/grpc":
		case "application/grpc-web":
		case "application/grpc+proto":
		case "application/octet-stream": {
			//Console.debug(`$response.body: ${JSON.stringify($response.body)}`);
			let rawBody = $response.bodyBytes ? new Uint8Array($response.bodyBytes) : ($response.body ?? new Uint8Array());
			//Console.debug(`isBuffer? ${ArrayBuffer.isView(rawBody)}: ${JSON.stringify(rawBody)}`);
			switch (FORMAT) {
				case "application/protobuf":
				case "application/x-protobuf":
				case "application/vnd.google.protobuf":
					break;
				case "application/grpc":
				case "application/grpc+proto":
				case "application/grpc-web":
					switch (FORMAT) {
						case "application/grpc":
						case "application/grpc+proto":
							$response.headers = fixHeaders($request.headers, $response.headers);
							rawBody = gRPC.decode(rawBody);
							break;
						case "application/grpc-web": {
							const { bodyBytes, header } = gRPC.decodeWeb(rawBody);
							rawBody = bodyBytes;
							$response.headers = fixHeaders($request.headers, { ...$request.headers, ...($response.headers ?? {}), ...header });
							break;
						}
					}
					// headers修复
					// 解析链接并处理protobuf数据
					// 主机判断
					switch (url.hostname) {
						case "grpc.biliapi.net": // HTTP/2
						case "app.biliapi.net": // HTTP/1.1
						case "app.bilibili.com": // HTTP/1.1
						case "app.biliapi.com": // HTTP/1.1
							switch (PATHs?.[0]) {
								case "bilibili.app.playurl.v1.PlayURL": // 投稿视频
									switch (PATHs?.[1]) {
										case "PlayView": {
											// 播放地址
											body = PlayViewReply.fromBinary(rawBody);
											const oldBackgroundConf = body.playArc?.backgroundPlayConf;
											if (oldBackgroundConf && (!oldBackgroundConf.isSupport || oldBackgroundConf.disabled)) {
												Console.info("✅ 后台播放限制去除");
												body.playArc.backgroundPlayConf.isSupport = true;
												body.playArc.backgroundPlayConf.disabled = false;
												body.playArc.backgroundPlayConf.extraContent = null;
											} else {
												Console.warn("无后台播放限制");
											}
											rawBody = PlayViewReply.toBinary(body);
											break;
										}
										case "PlayConf": // 播放配置
											break;
									}
									break;
								case "bilibili.app.playerunite.v1.Player": // 新版播放器
									switch (PATHs?.[1]) {
										case "PlayViewUnite":
											if (Settings?.View?.AD !== false) {
												body = PlayViewUniteReply.fromBinary(rawBody);
												if (body.viewInfo?.promptBar) {
													body.viewInfo.promptBar = undefined;
													Console.info("✅ 新版播放器推广提示栏去除");
												}
												if (body.fragmentVideo?.videos?.length) {
													const oldLength = body.fragmentVideo.videos.length;
													body.fragmentVideo.videos = body.fragmentVideo.videos.filter(item => item.fragmentInfo?.fragmentType !== FragmentType.AD_FRAGMENT);
													if (oldLength !== body.fragmentVideo.videos.length) Console.info(`✅ 播放器广告视频片段去除: ${oldLength - body.fragmentVideo.videos.length}`);
												}
												rawBody = PlayViewUniteReply.toBinary(body);
											} else Console.warn("用户设置新版播放器广告不去除");
											break;
									}
									break;
								case "bilibili.app.dynamic.v2.Dynamic": // 动态
									switch (PATHs?.[1]) {
										case "DynAll": // 动态综合页
											body = DynAllReply.fromBinary(rawBody);
											switch (Settings?.Dynamic?.HotTopics) {
												case true:
												default:
													Console.info("✅ 动态综合页热门话题去除");
													body.topicList = undefined;
													break;
												case false:
													Console.warn("用户设置动态综合页热门话题不去除");
													break;
											}
											switch (Settings?.Dynamic?.MostVisited) {
												case true:
													Console.info("✅ 动态综合页最常访问去除");
													body.upList = undefined;
													break;
												case false:
												default:
													switch (Settings?.Dynamic?.MostVisitedLiveOnly) {
														case true:
															Console.info("✅ 动态综合页最常访问仅显示直播");
															if (body.upList?.list?.length || body.upList?.listSecond?.length) {
																body.upList.list = [...(body.upList.list || []), ...(body.upList.listSecond || [])].filter(item => {
																	return adBlock.isDynamicLiveItem(item);
																});
																body.upList.listSecond = [];
															} else {
																body.upList = undefined;
															}
															break;
														case false:
														default:
															Console.warn("用户设置动态综合页最常访问不去除");
															break;
													}
													break;
											}
											switch (Settings?.Dynamic?.AdCard) {
												case true:
												default:
													if (body.dynamicList?.list?.length) {
														body.dynamicList.list = body.dynamicList.list.filter(item => {
															if (adBlock.isDynamicAd(item)) {
																Console.info("✅ 动态综合页广告动态去除");
																return false;
															} else return true;
														});
													}
													break;
												case false:
													Console.warn("用户设置动态综合页广告动态不去除");
													break;
											}
											rawBody = DynAllReply.toBinary(body);
											break;
										case "DynVideo": // 动态视频页
											body = DynVideoReply.fromBinary(rawBody);
											switch (Settings?.Dynamic?.AdCard) {
												case true:
												default:
													if (body.dynamicList?.list?.length) {
														body.dynamicList.list = body.dynamicList.list.filter(item => {
															if (adBlock.isDynamicAd(item)) {
																Console.info("✅ 动态视频页广告动态去除");
																return false;
															}
															return true;
														});
													}
													break;
												case false:
													Console.warn("用户设置动态视频页广告动态不去除");
													break;
											}
											switch (Settings?.Dynamic?.MostVisited) {
												case true:
													Console.info("✅ 动态视频页最常访问去除");
													body.videoUpList = undefined;
													break;
												case false:
												default:
													Console.warn("用户设置动态视频页最常访问不去除");
													break;
											}
											rawBody = DynVideoReply.toBinary(body);
											break;
										case "DynAllPersonal":
										case "DynVideoPersonal": {
											// 个人动态流
											if (Settings?.Dynamic?.PersonalAdCard) {
												const ReplyType = PATHs[1] === "DynAllPersonal" ? DynAllPersonalReply : DynVideoPersonalReply;
												body = ReplyType.fromBinary(rawBody);
												const oldLength = body.list.length;
												body.list = body.list.filter(item => !adBlock.isDynamicAd(item));
												Console.info(`✅ 个人动态流广告卡片去除: ${oldLength - body.list.length}`);
												rawBody = ReplyType.toBinary(body);
											} else Console.warn("用户设置个人动态流广告卡片不去除");
											break;
										}
									}
									break;
								case "bilibili.app.view.v1.View": {
									// 视频
									const filterRelate = item => {
										if (adBlock.isLegacyRelateAd(item)) {
											Console.info("✅ 播放页关联推荐广告去除");
											return false;
										}
										return true;
									};
									switch (PATHs?.[1]) {
										case "View": // 视频播放页
											switch (Settings?.View?.AD) {
												case true:
												default:
													body = ViewReply.fromBinary(rawBody);
													if (body.cms?.length) {
														Console.info("✅ 播放页广告卡片去除");
														body.cms = [];
													}
													if (body.relates?.length) {
														body.relates = body.relates.filter(filterRelate);
													}
													if (body.cmConfig || body.cmIpad || body.cmUnderPlayer) {
														Console.info("✅ 播放页广告配置去除");
														body.cmConfig = undefined;
														body.cmIpad = undefined;
														body.cmUnderPlayer = undefined;
													}
													if (body.tab?.otype === 3 || body.tab?.adTabInfo) {
														Console.info("✅ 播放页广告 Tab 去除");
														body.tab = undefined;
													}
													for (const i in body.tIcon) {
														if (body.tIcon[i] === null) {
															// 解决tIcon的null is not an object问题
															// console.log(`tIconMap:${i}`);
															delete body.tIcon[i];
														}
													}
													rawBody = ViewReply.toBinary(body);
													break;
												case false:
													Console.warn("用户设置播放页广告不去除");
													break;
											}
											break;
										case "RelatesFeed": // 播放页下方推荐卡
											body = ViewRelatesFeedReply.fromBinary(rawBody);
											if (Settings?.View?.AD !== false) body.list = body.list.filter(filterRelate);
											else Console.warn("用户设置播放页关联推荐广告不去除");
											rawBody = ViewRelatesFeedReply.toBinary(body);
											break;
										case "PlayerRelates": // 播放器下方推荐卡
											body = PlayerRelatesReply.fromBinary(rawBody);
											if (Settings?.View?.AD !== false) body.list = body.list.filter(filterRelate);
											else Console.warn("用户设置播放器关联推荐广告不去除");
											rawBody = PlayerRelatesReply.toBinary(body);
											break;
										case "ViewProgress": // 播放过程中的引导卡片
											body = ViewProgressReply.fromBinary(rawBody);
											if (Settings?.View?.AD !== false && body.videoGuide) {
												body.videoGuide = undefined;
												Console.info("✅ 旧版播放器过程引导卡片去除");
											} else if (Settings?.View?.AD === false) Console.warn("用户设置旧版播放器过程引导卡片不去除");
											rawBody = ViewProgressReply.toBinary(body);
											break;
										case "TFInfo": {
											body = TFInfoReply.fromBinary(rawBody);
											Console.debug(`tipsId: ${body.tipsId}`);
											if (body?.tipsId) {
												Console.info("✅ 播放页办卡免流广告去除");
												body.tfToast = undefined;
												body.tfPanelCustomized = undefined;
											}
											rawBody = TFInfoReply.toBinary(body);
											break;
										}
									}
									break;
								}
								case "bilibili.app.viewunite.v1.View": {
									// 视频
									// 4: 游戏, 5: 广告, 11: 课程
									// cmStock: 广告字段, uniqueId: 推广视频
									const filterRelateCard = card => {
										if (adBlock.isUnifiedRelateAd(card)) {
											Console.info("✅ 视频详情下方推荐列表广告去除");
											return false;
										}
										return true;
									};
									switch (PATHs?.[1]) {
										case "View": // 视频播放页
											switch (Settings?.View?.AD) {
												case true:
												default:
													body = ViewUniteReply.fromBinary(rawBody);
													Console.debug(`ViewUniteReply: ${JSON.stringify(body, null, 2)}`);
													if (body.cm) {
														Console.info("✅ 视频下方广告去除");
														body.cm = undefined;
													}
													if (body.tab?.tabModule?.[0]?.tab?.introduction?.modules) {
														body.tab.tabModule[0].tab.introduction.modules = body.tab.tabModule[0].tab.introduction.modules
															.map(i => {
																if (i.type === 28 && i.data?.relates?.cards) {
																	i.data.relates.cards = i.data.relates.cards.filter(filterRelateCard);
																}
																return i;
															})
															.filter(i => {
																const label = adBlock.getPromotionalModuleLabel(i);
																if (label) {
																	Console.info(`✅ ${label}去除`);
																	return false;
																}
																return true;
															});
													}
													rawBody = ViewUniteReply.toBinary(body);
													break;
												case false:
													Console.warn("用户设置up主推荐广告不去除");
													break;
											}
											break;
										case "RelatesFeed": // 播放页下方推荐卡
											body = RelatesFeedReply.fromBinary(rawBody);
											if (Settings?.View?.AD !== false) body.relates = body.relates.filter(filterRelateCard);
											else Console.warn("用户设置播放页关联推荐广告不去除");
											rawBody = RelatesFeedReply.toBinary(body);
											break;
										case "ViewProgress": // 播放过程中的素材
											body = ViewUniteProgressReply.fromBinary(rawBody);
											if (Settings?.View?.AD !== false && body.videoGuide?.material?.length) {
												body.videoGuide.material = [];
												Console.info("✅ 新版播放器过程推广素材去除");
											} else if (Settings?.View?.AD === false) Console.warn("用户设置新版播放器过程推广素材不去除");
											rawBody = ViewUniteProgressReply.toBinary(body);
											break;
										case "PlayPause": // 暂停广告
										case "ViewEndPage": // 播放结束页广告
											if (Settings?.View?.AD !== false) {
												rawBody = new Uint8Array();
												Console.info(`✅ ${PATHs[1] === "PlayPause" ? "播放暂停广告" : "播放结束页广告"}去除`);
											} else Console.warn(`用户设置${PATHs[1] === "PlayPause" ? "播放暂停广告" : "播放结束页广告"}不去除`);
											break;
									}
									break;
								}
								case "bilibili.app.interface.v1.Teenagers": // 青少年模式
									switch (PATHs?.[1]) {
										case "ModeStatus": // 青少年模式
											body = ModeStatusReply.fromBinary(rawBody);
											for (const mode of body.modes) {
												if (mode?.name === "teenagers" && mode?.f5?.f1) {
													mode.f5.f1 = 0;
													Console.info("✅ 青少年模式弹窗去除");
												}
											}
											rawBody = ModeStatusReply.toBinary(body);
											break;
									}
									break;
								case "bilibili.community.service.dm.v1.DM": //弹幕
									switch (PATHs?.[1]) {
										case "DmView": // 弹幕配置
											body = DmViewReply.fromBinary(rawBody);
											switch (Settings?.DM?.Command) {
												case true:
													for (const group of body.commandDms) group.data = [];
													Console.info("✅ 交互式弹幕去除");
													break;
												case false:
												default:
													Console.warn("用户设置交互式弹幕不去除");
													break;
											}
											if (body.activityMeta.length) {
												Console.info("✅ 雲視聽水印去除");
												body.activityMeta = [];
											}
											rawBody = DmViewReply.toBinary(body);
											break;
										case "DmSegMobile": // 弹幕列表
											body = DmSegMobileReply.fromBinary(rawBody);
											switch (Settings?.DM?.Colorful) {
												case true:
													for (const element of body.elems) {
														if (adBlock.isColorfulDanmaku(element)) element.colorful = DmColorfulType.NoneType;
													}
													Console.info("✅ 会员弹幕已替换为普通弹幕");
													break;
												case false:
												default:
													Console.warn("用户设置会员弹幕不修改");
													break;
											}
											switch (Settings?.DM?.Airborne) {
												case true: {
													Console.warn("空降助手: 获取 Segment");
													const requestBody = takeAirborneRequest($request);
													if (!requestBody) {
														Console.warn("空降助手: 未获取到 Segment 请求参数");
														break;
													}
													const { oid, pid, type } = requestBody;
													if (type !== 1) {
														Console.warn(`空降助手: 不支持的弹幕类型 type=${type}，仅支持视频弹幕(type=1)`);
														break;
													}
													// 构建响应体
													body.elems.push(...(await getAirborneDanmaku(pid, oid)));
													Console.info("✅ 空降助手");
													break;
												}
												case false:
												default:
													Console.warn("用户设置空降助手关闭");
													break;
											}
											rawBody = DmSegMobileReply.toBinary(body);
											break;
									}
									break;
								case "bilibili.main.community.reply.v1.Reply":
									{
										//评论区
										switch (PATHs?.[1]) {
											case "MainList": {
												body = MainListReply.fromBinary(rawBody);
												if (Settings?.Reply?.AD) {
													body.topReplies = body.topReplies.filter(item => {
														if (adBlock.isCommercialReply(item)) {
															Console.info("✅ 评论置顶带货广告去除");
															return false;
														}
														return true;
													});
													for (const key of ["upTop", "adminTop", "voteTop"]) {
														if (adBlock.isCommercialReply(body[key])) {
															body[key] = undefined;
															Console.info(`✅ 评论${key}带货广告去除`);
														}
													}
													if (body.cm) {
														body.cm = undefined;
														Console.info("✅ 评论列表广告去除");
													}
													body.subjectTopCards = body.subjectTopCards.filter(item => !adBlock.isCommercialTopCard(item));
												} else {
													Console.warn("用户设置评论列表广告不去除");
												}
												const replies = [...body.replies, ...body.topReplies, body.upTop, body.adminTop, body.voteTop];
												if (Settings?.Reply?.CommercialLinks || Settings?.Privacy?.Strict) {
													let changed = 0;
													for (const reply of replies) changed += adBlock.cleanReplyCommercialLinks(reply);
													if (changed) Console.info(`✅ 普通评论商业跳转去除: ${changed}`);
												}
												if (Settings?.Privacy?.Tracking || Settings?.Privacy?.Strict) {
													let changed = 0;
													for (const reply of replies) changed += adBlock.cleanReplyTracking(reply);
													if (changed) Console.info(`✅ 评论跳转链接跟踪参数去除: ${changed}`);
												}
												rawBody = MainListReply.toBinary(body);
												break;
											}
											case "DetailList": {
												body = DetailListReply.fromBinary(rawBody);
												if (Settings?.Reply?.CommercialLinks || Settings?.Privacy?.Strict) adBlock.cleanReplyCommercialLinks(body.root);
												if (Settings?.Privacy?.Tracking || Settings?.Privacy?.Strict) adBlock.cleanReplyTracking(body.root);
												rawBody = DetailListReply.toBinary(body);
												break;
											}
											case "ReplyInfo": {
												body = ReplyInfoReply.fromBinary(rawBody);
												if (Settings?.Reply?.CommercialLinks || Settings?.Privacy?.Strict) adBlock.cleanReplyCommercialLinks(body.reply);
												if (Settings?.Privacy?.Tracking || Settings?.Privacy?.Strict) adBlock.cleanReplyTracking(body.reply);
												rawBody = ReplyInfoReply.toBinary(body);
												break;
											}
										}
									}
									break;
								case "bilibili.main.community.reply.v2.Reply": // 评论编辑器能力
									switch (PATHs?.[1]) {
										case "SubjectDescription":
											if (Settings?.Reply?.SubjectDescriptionCommercial) {
												body = SubjectDescriptionReply.fromBinary(rawBody);
												if (Array.isArray(body.input?.funcButtons?.buttons)) {
													const oldLength = body.input.funcButtons.buttons.length;
													body.input.funcButtons.buttons = body.input.funcButtons.buttons.filter(button => !adBlock.isCommercialEditorButton(button));
													Console.info(`✅ 评论编辑器商品能力去除: ${oldLength - body.input.funcButtons.buttons.length}`);
												}
												rawBody = SubjectDescriptionReply.toBinary(body);
											} else Console.warn("用户设置评论编辑器商品能力不去除");
											break;
									}
									break;
								case "bilibili.pgc.gateway.player.v2.PlayURL": // 番剧
									switch (PATHs?.[1]) {
										case "PlayView": // 播放地址
											body = PGCPlayViewReply.fromBinary(rawBody);
											if (body.viewInfo?.tryWatchPromptBar) {
												body.viewInfo.tryWatchPromptBar = undefined;
												Console.info("✅ 番剧播放器下方提示栏去除");
											}
											if (body.playExtConf?.castTips) {
												body.playExtConf.castTips = { code: 0, message: "" };
												Console.info("✅ 番剧播放器下方提示栏去除");
											}
											rawBody = PGCPlayViewReply.toBinary(body);
											break;
										case "PlayConf": // 播放配置
											break;
									}
									break;
								case "bilibili.app.nativeact.v1.NativeAct": // 活动-节目、动画、韩综（港澳台）
									switch (PATHs?.[1]) {
										case "Index": // 首页
											break;
									}
									break;
								case "bilibili.app.interface.v1.Search": // 搜索框
									switch (PATHs?.[1]) {
										case "Suggest3": // 搜索建议
											break;
									}
									break;
								case "bilibili.polymer.app.search.v1.Search": {
									// 搜索结果
									switch (PATHs?.[1]) {
										case "SearchAll": {
											// 全部结果（综合）
											const removeAD = Settings?.Search?.AD;
											const removeTracking = Settings?.Search?.Tracking || Settings?.Privacy?.Strict;
											if (removeAD || removeTracking) {
												body = SearchAllResponse.fromBinary(rawBody);
												if (removeAD) {
													const oldLength = body.item.length;
													body.item = body.item.filter(item => !adBlock.isSearchAd(item));
													Console.info(`✅ 搜索页广告去除: ${oldLength - body.item.length}`);
												} else Console.warn("用户设置搜索页广告不去除");
												if (removeTracking) {
													const changed = adBlock.cleanTracking(body, "Search");
													Console.info(`✅ 搜索页响应跟踪参数去除: ${changed}`);
												} else Console.warn("用户设置搜索页响应跟踪参数不去除");
												rawBody = SearchAllResponse.toBinary(body);
											}
											break;
										}
										case "SearchByType": {
											// 分类结果（番剧、用户、影视、专栏）
											break;
										}
									}
									break;
								}
							}
							rawBody = gRPC.encode(rawBody);
							switch (FORMAT) {
								case "application/grpc-web":
									if ($response.headers?.["Content-Type"]) $response.headers["Content-Type"] = "application/grpc";
									if ($response.headers?.["content-type"]) $response.headers["content-type"] = "application/grpc";
									break;
							}
							break;
					}
					// 写入二进制数据
					$response.body = rawBody;
					break;
			}
		}
	}
	return $response;
}

/*
 * Bilibili 多主机重试函数。
 * 当前流程没有调用，暂时整段注释保留，后续需要上游重试时可重新启用并补齐 ctx 来源。
async function fetchBilibili($request, maxRetries = 2) {
	const { method, url: sourceUrl, headers, bodyBytes } = $request;
	const url = new URL(sourceUrl);
	const hosts = ["grpc.biliapi.net", "app.bilibili.com"];

	const startIndex = hosts.indexOf(url.hostname);
	const endIndex = Math.min(startIndex + maxRetries, hosts.length);

	for (let i = startIndex; i < endIndex; i++) {
		url.hostname = hosts[i];
		const request = { method, url: url.toString(), headers, body: bodyBytes, timeout: 3 };
		try {
			const response = await fetch(request.url, request);

			if (response.status === 200 && response.body) {
				return response;
			}

			Console.info("[Bilibili] Invalid response", {
				method: request.method,
				url: request.url,
				status: response.status,
				headers: response.headers,
				body: response.bodyBytes,
			});
		} catch (e) {
			Console.info("[Bilibili]", e, {
				method: request.method,
				url: request.url,
			});
		}
	}

	Console.error("[Bilibili] All hosts failed", {
		method: ctx.method,
		url: ctx.request.url,
	});
}
*/
