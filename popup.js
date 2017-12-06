const $ = q => document.querySelector(q)
const $$ = q => document.querySelectorAll(q)

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

async function reset_view() {
	if(await iCloud.validate())
		document.body.setAttribute("class", "sync")
	else
		document.body.setAttribute("class", "login")

	$("#login-error").removeAttribute("class")
	$("#sync-btn-sync").removeAttribute("class")
	$("#disabled-overlay").removeAttribute("class")
}
async function main() {
	await get_storage_info()
	await reset_view()

	$("#login-btn").addEventListener("click", async (e) => {
		let err = $("#login-error")
		let id = $("#login-id").value
		let psw = $("#login-psw").value

		err.removeAttribute("class")
		$("#disabled-overlay").setAttribute("class", "show")
		try {
			await iCloud.authenticate(id, psw)
			reset_view()
		} catch(errorCode) {
			err.setAttribute("class", "show")
			err.innerText = "Authentication failed! Error: " + errorCode
			$("#disabled-overlay").removeAttribute("class")
		}
	})

	$("#sync-btn-sync").addEventListener("click", () => {
		$("#sync-btn-sync").setAttribute("class", "fa-spin")
		$("#disabled-overlay").setAttribute("class", "show")

		chrome.tabs.query({}, async (tabs) => {
			tabs = tabs.filter(t => !t.url.startsWith("chrome"))
			await iCloud.update_tabs(tabs.map(t => ({ "Title": t.title, "URL": t.url, "UUID": uuidv4() })))
			reset_view()
		})
	})
	$("#sync-btn-list").addEventListener("click", async () => {
		let list = $("#list-devs")
		while(list.firstChild) list.removeChild(list.firstChild)

		document.body.setAttribute("class", "list")

		let [keys, registry_version] = await iCloud.get_registry_keys()
		for(let key of keys) {
			if(key.name === iCloud.deviceUUID) continue

			let h2 = document.createElement("h2")
			h2.innerText = key.data.DeviceName
			list.appendChild(h2)
			for(let tab of key.data.Tabs) {
				let a = document.createElement("a")
				a.innerText = tab.Title
				a.setAttribute("href", tab.URL)
				a.setAttribute("target", "_blank")
				list.appendChild(a)
			}
		}
	})
	$("#sync-btn-disc").addEventListener("click", async () => {
		$("#disabled-overlay").setAttribute("class", "show")

		await update_tabs(null)
		chrome.cookies.getAll({ domain: "icloud.com" }, cookies => {
			for(let i = 0; i < cookies.length; i++) {
				cookies[i].domain = cookies[i].domain == ".icloud.com" ? "icloud.com" : cookies[i].domain
				chrome.cookies.remove({ url: "https://" + cookies[i].domain + cookies[i].path, name: cookies[i].name })
			}
		})
		setTimeout(reset_view, 100)
	})
	$("#list-btn-back").addEventListener("click", () => {
		reset_view()
	})
}

document.addEventListener('DOMContentLoaded', () => main())