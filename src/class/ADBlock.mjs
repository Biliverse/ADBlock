export default class ADBlock {
	#Config = {
		DM: {
			VipColorfulTypes: [60001],
		},
		Dynamic: {
			AdCardTypes: [15],
			LiveStates: [1],
		},
		Feed: {
			StoryAdCardGotos: ["vertical_ad_av", "vertical_ad_picture", "vertical_ad_live", "vertical_pgc"],
			StoryCommercialButtonTypes: [20],
			StoryCommercialLinks: [{ hostname: "cm.bilibili.com", pathname: "/fly-h5" }],
			StoryCommercialTexts: ["助TA必火"],
		},
		Privacy: {
			TrackingParameters: [
				"bsource",
				"from_comid",
				"from_source",
				"from_spmid",
				"from_trackid",
				"live_from",
				"msource",
				"report_flow_data",
				"search_from_source",
				"seid",
				"share_medium",
				"share_plat",
				"share_session_id",
				"share_source",
				"share_tag",
				"spm_id_from",
				"spmid",
				"track_id",
				"trackid",
				"unique_k",
				"vd_source",
			],
			TrackingFields: {
				JSON: ["report_flow_data", "track_id", "trackid"],
				Search: ["reportFlowData", "trackId", "trackid"],
			},
			URLFields: {
				JSON: ["appUrlSchema", "app_url_schema", "jumpUri", "jumpUrl", "jump_uri", "jump_url", "link", "pcUrl", "pc_url", "uri", "url"],
				Search: ["appUrlSchema", "jumpUri", "jumpUrl", "link", "liveLink", "pcUrl", "uri", "url"],
			},
			LiveTrackingParameters: ["trackid"],
		},
		Search: {
			AdCardKinds: ["cm", "game"],
			HotSearchTypes: ["trending"],
		},
		Reply: {
			CommercialEditorButtonTypes: [5, 8],
			CommercialTopCardTypes: [3],
			CommercialURLPattern: /https?:\/\/(?:b23\.tv\/(?:cm|mall)|cm\.bilibili\.com\/ad-showcase-h5\/?#\/goods-select)/i,
		},
		View: {
			LegacyRelateGotos: ["cm", "game"],
			PromotionalModuleLabels: {
				18: "番剧下方活动横幅",
				29: "番剧标题下方大会员横幅广告",
				55: "视频详情下方up主分享好物",
			},
			UnifiedRelateCardTypes: [4, 5, 11],
		},
	};

	isObject(value) {
		return value !== null && typeof value === "object";
	}

	cleanTracking(value, type = "JSON") {
		if (Array.isArray(value)) {
			return value.reduce((changed, item) => changed + this.cleanTracking(item, type), 0);
		}
		if (!this.isObject(value)) return 0;
		const trackingFields = this.#Config.Privacy.TrackingFields[type] ?? this.#Config.Privacy.TrackingFields.JSON;
		const urlFields = this.#Config.Privacy.URLFields[type] ?? this.#Config.Privacy.URLFields.JSON;
		let changed = 0;
		for (const [key, child] of Object.entries(value)) {
			if (trackingFields.includes(key)) {
				const replacement = type === "Search" ? "" : undefined;
				if (value[key] !== replacement) changed++;
				value[key] = replacement;
				continue;
			}
			if (urlFields.includes(key) && typeof child === "string") {
				const sanitized = this.sanitizeUrl(child);
				if (sanitized !== child) {
					value[key] = sanitized;
					changed++;
				}
				continue;
			}
			changed += this.cleanTracking(child, type);
		}
		return changed;
	}

	sanitizeUrl(value, parameters = this.#Config.Privacy.TrackingParameters) {
		if (typeof value !== "string" || value.length === 0) return value;
		const protocolRelative = value.startsWith("//");
		if (!protocolRelative && !/^[a-z][a-z\d+.-]*:\/\//i.test(value)) return value;
		try {
			const url = new URL(protocolRelative ? `https:${value}` : value);
			let changed = false;
			for (const name of [...url.searchParams.keys()]) {
				if (parameters.includes(name.toLowerCase())) {
					url.searchParams.delete(name);
					changed = true;
				}
			}
			if (!changed) return value;
			const sanitized = url.toString();
			return protocolRelative ? sanitized.replace(/^https:/, "") : sanitized;
		} catch {
			return value;
		}
	}

	isFeedAd(item) {
		if (!this.isObject(item)) return false;
		const cardType = typeof item.card_type === "string" ? item.card_type : "";
		const cardGoto = typeof item.card_goto === "string" ? item.card_goto : "";
		return cardType.startsWith("cm_") || cardGoto.startsWith("ad_") || item.goto === "ad" || item.is_ad === true;
		//修改此处兜底规则，包含ad_info的对象实测下来不完全是广告，故删除。
		//return (Object.prototype.hasOwnProperty.call(item, "ad_info") && item.ad_info !== null) || cardType.startsWith("cm_") || cardGoto.startsWith("ad_") || item.goto === "ad" || item.is_ad === true;
	}

	isStoryAd(item) {
		return this.#Config.Feed.StoryAdCardGotos.includes(item?.card_goto);
	}

	isStoryCommercialMeta(meta) {
		if (!this.isObject(meta)) return false;
		if (this.#Config.Feed.StoryCommercialTexts.includes(meta.text)) return true;
		try {
			const link = new URL(meta.link);
			return this.#Config.Feed.StoryCommercialLinks.some(rule => link.hostname === rule.hostname && link.pathname === rule.pathname);
		} catch {
			return false;
		}
	}

	isDynamicAd(item) {
		return this.#Config.Dynamic.AdCardTypes.includes(item?.cardType ?? item?.card_type);
	}

	isDynamicLiveItem(item) {
		return this.#Config.Dynamic.LiveStates.includes(item?.liveState ?? item?.live_state);
	}

	cleanStoryItem(item, removeCommercial, removeTracking) {
		if (!this.isObject(item)) return item;
		if (removeCommercial && Array.isArray(item.share_bottom_button)) {
			item.share_bottom_button = item.share_bottom_button.filter(button => {
				if (!this.isObject(button) || !this.#Config.Feed.StoryCommercialButtonTypes.includes(button.type)) return true;
				return !Array.isArray(button.button_metas) || !button.button_metas.some(meta => this.isStoryCommercialMeta(meta));
			});
		}
		if (removeTracking) this.cleanTracking(item);
		return item;
	}

	isLiveCardAd(card) {
		if (!this.isObject(card)) return false;
		const explicitAd = value => value === true || value === 1 || value === "1";
		const transparent = card.ad_transparent_content;
		const hasTransparentAd = typeof transparent === "string" ? transparent.trim().length > 0 : this.isObject(transparent) ? Object.keys(transparent).length > 0 : Boolean(transparent);
		return explicitAd(card.is_ad) || explicitAd(card.show_ad_icon) || hasTransparentAd;
	}

	isColorfulDanmaku(element) {
		return this.#Config.DM.VipColorfulTypes.includes(element?.colorful);
	}

	isLegacyRelateAd(item) {
		if (!this.isObject(item)) return false;
		return this.#Config.View.LegacyRelateGotos.includes(item.goto) || Boolean(item.cm || item.uniqueId);
	}

	isUnifiedRelateAd(card) {
		if (!this.isObject(card)) return false;
		return this.#Config.View.UnifiedRelateCardTypes.includes(card.relateCardType) || Boolean(card.cmStock || card.basicInfo?.uniqueId);
	}

	getPromotionalModuleLabel(module) {
		return this.#Config.View.PromotionalModuleLabels[module?.type];
	}

	cleanLiveCard(card, removeTracking, removeCallbacks, removePreloadTracking) {
		if (!this.isObject(card)) return;
		if (removeTracking) {
			card.trackid = undefined;
			card.track_id = undefined;
			card.report_flow_data = undefined;
			card.link = this.sanitizeUrl(card.link, this.#Config.Privacy.LiveTrackingParameters);
		}
		if (removeCallbacks) {
			card.show_callback = undefined;
			card.click_callback = undefined;
		}
		if (removePreloadTracking && typeof card.subtitle_style?.link === "string") card.subtitle_style.link = this.sanitizeUrl(card.subtitle_style.link, this.#Config.Privacy.LiveTrackingParameters);
	}

	isCommercialUrl(value) {
		return this.#Config.Reply.CommercialURLPattern.test(String(value ?? ""));
	}

	isCommercialTopCard(card) {
		return this.#Config.Reply.CommercialTopCardTypes.includes(card?.type);
	}

	isCommercialEditorButton(button) {
		return this.#Config.Reply.CommercialEditorButtonTypes.includes(button?.type);
	}

	isSearchAd(item) {
		return this.#Config.Search.AdCardKinds.includes(item?.cardItem?.oneofKind);
	}

	isHotSearchItem(item) {
		return this.#Config.Search.HotSearchTypes.includes(item?.type);
	}

	isCommercialReply(reply) {
		if (!this.isObject(reply) || !this.isObject(reply.content)) return false;
		if (this.isCommercialUrl(reply.content.message)) return true;
		for (const [key, link] of Object.entries(reply.content.url ?? {})) {
			if (this.isCommercialUrl(key)) return true;
			if (this.isObject(link) && (this.isCommercialUrl(link.appUrlSchema) || this.isCommercialUrl(link.pcUrl))) return true;
		}
		return false;
	}

	cleanReplyCommercialLinks(reply) {
		if (!this.isObject(reply)) return 0;
		let changed = 0;
		for (const [key, link] of Object.entries(reply.content?.url ?? {})) {
			if (this.isCommercialUrl(key) || (this.isObject(link) && (this.isCommercialUrl(link.appUrlSchema) || this.isCommercialUrl(link.pcUrl)))) {
				delete reply.content.url[key];
				changed++;
			}
		}
		for (const child of Array.isArray(reply.replies) ? reply.replies : []) changed += this.cleanReplyCommercialLinks(child);
		return changed;
	}

	cleanReplyTracking(reply) {
		if (!this.isObject(reply)) return 0;
		let changed = 0;
		for (const link of Object.values(reply.content?.url ?? {})) {
			if (!this.isObject(link)) continue;
			const appUrlSchema = this.sanitizeUrl(link.appUrlSchema);
			const pcUrl = this.sanitizeUrl(link.pcUrl);
			if (appUrlSchema !== link.appUrlSchema) {
				link.appUrlSchema = appUrlSchema;
				changed++;
			}
			if (pcUrl !== link.pcUrl) {
				link.pcUrl = pcUrl;
				changed++;
			}
			if (link.clickReport) {
				link.clickReport = "";
				changed++;
			}
			if (link.exposureReport) {
				link.exposureReport = "";
				changed++;
			}
		}
		for (const child of Array.isArray(reply.replies) ? reply.replies : []) changed += this.cleanReplyTracking(child);
		return changed;
	}
}
