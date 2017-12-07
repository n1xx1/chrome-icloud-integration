const $ = q => document.querySelector(q)
const $$ = q => document.querySelectorAll(q)

Array.prototype.flatten = function() {
	return this.reduce((f, n) => f.concat(Array.isArray(n) ? n.flatten() : n), [])
}

function h(n, attr={}, ...children) {
	let el = typeof n === "string" ? document.createElement(n) : n
	for(let k in attr) el.setAttribute(k, attr[k])
	children.flatten().forEach(c => el.appendChild(typeof c === "string" ? document.createTextNode(c) : c))
	return el
}

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
	reset_modal()
}
function reset_modal() {
	let over = $("#disabled-overlay>.inner")
	while(over.firstChild) over.removeChild(over.firstChild)
	$("#disabled-overlay").removeAttribute("class")
}
function do_update_tabs() {
	chrome.tabs.query({}, async (tabs) => {
		tabs = tabs.filter(t => !t.url.startsWith("chrome"))
		await iCloud.update_tabs(tabs.map(t => ({ "Title": t.title, "URL": t.url, "UUID": uuidv4() })))
		reset_view()
	})
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
		do_update_tabs()
	})
	$("#sync-btn-list").addEventListener("click", async () => {
		let list = $("#list-devs")
		while(list.firstChild) list.removeChild(list.firstChild)

		document.body.setAttribute("class", "list")

		let [keys, registry_version] = await iCloud.get_registry_keys()
		h(list, {},
			keys.filter(key => key.name !== iCloud.deviceUUID)
				.map(key => [
					h("h2", {}, key.data.DeviceName),
					key.data.Tabs.map(tab =>
						h("a", {"href": tab.URL, "target": "_blank"}, tab.Title))])
		)
	})
	$("#sync-btn-settings").addEventListener("click", () => {
		document.body.setAttribute("class", "settings")
	})

	$("#settings-btn-chdev").addEventListener("click", () => {
		$("#disabled-overlay").setAttribute("class", "show modal")
		let over = $("#disabled-overlay>.inner"), closebtn, changebtn, cancelbtn, input

		h(over, {},
			closebtn = h("button", {"class": "modal-close"}, h("i", {"class": "fas fa-times"})),
			h("h2", {}, "Set the new Device Name"),
			input = h("input", {"type": "text", "placeholder": "DeviceName", "value": iCloud.deviceName}),
			changebtn = h("button", {}, "Change"),
			cancelbtn = h("button", {}, "Cancel")
		)

		closebtn.addEventListener("click", () => reset_modal())
		cancelbtn.addEventListener("click", () => reset_modal())
		changebtn.addEventListener("click", async () => {
			$("#disabled-overlay").setAttribute("class", "show")
			set_storage_info(iCloud.deviceUUID, input.value)
			do_update_tabs()
		})
	})
	$("#settings-btn-disc").addEventListener("click", async () => {
		$("#disabled-overlay").setAttribute("class", "show")

		await update_tabs(null)
		await iCloud.logout()
		reset_view()
	})
	$("#settings-btn-remdev").addEventListener("click", async () => {
		$("#disabled-overlay").setAttribute("class", "show modal")
		let over = $("#disabled-overlay>.inner")

		let [keys, registry_version] = await iCloud.get_registry_keys()

		h(over, {},
			closebtn = h("button", {"class": "modal-close"}, h("i", {"class": "fas fa-times"})),
			h("div", {"class": "modal-list"}, keys.map(key => {
				let a = h("a", {"href": "#"}, `${key.data.DeviceName} (${key.name})`)
				a.addEventListener("click", async e => {
					await update_registry_key(registry_version, key.name, null)
					over.removeChild(a)
				})
				return a
			}))
		)

		closebtn.addEventListener("click", () => reset_modal())
	})
	//await self.update_registry_key(registry_version, keyName, keyValue)
	$("#list-btn-back").addEventListener("click", () => reset_view())
	$("#settings-btn-back").addEventListener("click", () => reset_view())
}

document.addEventListener('DOMContentLoaded', () => main())