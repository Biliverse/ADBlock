import { Lodash as _, Console } from "@nsnanocat/util";
import getStorage from "@nsnanocat/util/getStorage.mjs";

/**
 * 设置环境变量。
 * Set environment variables.
 * @author VirgilClyne
 * @param {string} name 持久化存储键。
 * Persistent store key.
 * @param {string|string[]} platforms 平台名称。
 * Platform names.
 * @param {object} database 默认数据库。
 * Default database.
 * @param {object} KV 可选的异步 KV 存储。
 * Optional asynchronous KV storage.
 * @returns {Promise<object>} 设置、缓存与配置。
 * Settings, caches, and configurations.
 */
export default async function setENV(name, platforms, database, KV) {
	Console.log("☑️ Set Environment Variables");
	const { Settings, Caches, Configs } = getStorage(name, platforms, database);
	if (KV) {
		for (const platform of [platforms].flat(Number.POSITIVE_INFINITY)) {
			_.merge(Caches, await KV.getItem(`@${name}.${platform}.Caches`, {}));
		}
	}
	/***************** Settings *****************/
	Console.info(`typeof Settings: ${typeof Settings}`, `Settings: ${JSON.stringify(Settings, null, 2)}`);
	/***************** Caches *****************/
	//Console.debug(`typeof Caches: ${typeof Caches}`, `Caches: ${JSON.stringify(Caches, null, 2)}`);
	/***************** Configs *****************/
	Console.log("✅ Set Environment Variables");
	return { Settings, Caches, Configs };
}
