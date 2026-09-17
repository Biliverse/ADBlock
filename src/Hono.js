import { KV as Storage } from "@auraflare/shared";
import { fetch } from "@nsnanocat/util";
import { Hono } from "hono/tiny";
import HonoWorkerAdapter from "./class/HonoWorkerAdapter.mjs";
import { Request } from "./process/Request.mjs";
import { Response } from "./process/Response.mjs";
/***************** 处理 *****************/
/***************** Processing *****************/
export default new Hono()
	.get("/", c => c.text("OK"))
	.all("/:rest{.*}", async c => {
		let $request = await HonoWorkerAdapter.buildRequest(c.req);
		$request = HonoWorkerAdapter.buildArgument($request);
		let $response;
		const KV = c.env
			? new Storage({
					env: {
						namespaces: new Map([
							["", c.env.PersistentStore],
							["@Biliverse.ADBlock", c.env.ADBlock],
						]),
					},
				})
			: undefined;
		({ $request, $response } = await Request($request, KV));
		switch (typeof $response) {
			case "undefined":
				$response = await fetch($request);
				$response = await Response($request, $response, KV);
				break;
			case "object":
				break;
			default:
				throw new TypeError(`Invalid response type: ${typeof $response}`);
		}
		return HonoWorkerAdapter.writeResponse(c, $response);
	})
	.onError((error, c) => {
		console.error(error);
		return c.body(error.message, 500);
	});
