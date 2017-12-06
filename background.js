function get_storage_info() {
	return new Promise((ful, rej) => {
		chrome.storage.local.get(["device-uuid", "device-name"], v => {
			iCloud.set_device_info(v["device-uuid"], v["device-name"])
			if(!v["device-uuid"] || !v["device-name"])
				set_storage_info(uuidv4(), "Chrome Desktop")
			ful()
		})
	})
}
function set_storage_info(uuid, name) {
	iCloud.set_device_info(uuid, name)
	return new Promise((ful, rej) => {
		chrome.storage.local.set({ "device-uuid": uuid, "device-name": name }, () => ful())
	})
}

async function onAlarm(alarm) {
	if(alarm.name === "syncTabs") {
		await get_storage_info()
		if(await iCloud.validate()) {
			chrome.tabs.query({}, async (tabs) => {
				let icloud_tabs = tabs
					.filter(t => !t.url.startsWith("chrome"))
					.map(t => ({ "Title": t.title, "URL": t.url, "UUID": uuidv4() }))
				await iCloud.update_tabs(icloud_tabs)
				console.log("tabs updated")
			})
		}
	}
}
function onBeforeSendHeaders(det) {
	for(let i = 0; i < det.requestHeaders.length; i++)
		if(det.requestHeaders[i].name === "Origin" && det.requestHeaders[i].value.startsWith("chrome-extension://"))
			det.requestHeaders[i].value = "https://www.icloud.com"
	return { requestHeaders: det.requestHeaders }
}

chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, { urls: ["https://*.icloud.com/*"] }, [ "blocking", "requestHeaders" ])
chrome.alarms.onAlarm.addListener(onAlarm)

chrome.alarms.create("syncTabs", { delayInMinutes: 1, periodInMinutes: 3 })