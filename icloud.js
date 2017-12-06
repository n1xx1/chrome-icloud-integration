function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	})
}

iCloud = (() => {
	function send_request(method, url, headers={}, body=null) {
		return new Promise((res, rej) => {
			let xhr = new XMLHttpRequest()
			xhr.open(method, url, true)
			for(let k in headers) xhr.setRequestHeader(k, headers[k])
			xhr.onload = (e) => {
				if(xhr.readyState === 4) res(xhr.responseText)
				else rej(xhr.statusText)
			}
			xhr.onerror = (e) => {
				rej(xhr.statusText)
			}
			xhr.send(body)
		})
	}

	async function send_json_request(url, body, headers={}) {
		let resp = await send_request("POST", url, Object.assign({"Content-Type": "application/json"}, headers), JSON.stringify(body))
		return JSON.parse(resp)
	}

	let self = {
		deviceName: "Chrome Desktop",
		deviceUUID: "23C0E9B8-52DE-48F2-B3DD-74F3158DE77C",
		dsid: null,
		set_device_info(uuid, name) {
			self.deviceName = name
			self.deviceUUID = uuid
		},
		async get_registry_keys() {
			if(!self.dsid) throw "must validate or authenticate"

			let keyvalue = await send_json_request(
				`https://p31-keyvalueservice.icloud.com/json/sync?clientBuildNumber=&clientId=&dsid=${self.dsid}`,
				{
					"apns-token": "APNSTOKENLMAOXD",
					"apps": [{
						"bundle-id": "com.apple.Safari",
						"kvstore-id": "com.apple.Safari.SyncedTabs",
						"registry-version": "registry-version"
					}],
					"service-id":"iOS"
				})
			return [keyvalue.apps[0].keys, keyvalue.apps[0]["registry-version"]]
		},
		async update_registry_key(registry_version, key, data) {
			if(!self.dsid) throw "must validate or authenticate"

			let value = { name: key }
			value[data ? "data" : "delete"] = data || true

			let keyvaluechange = await send_json_request(
				`https://p31-keyvalueservice.icloud.com/json/sync?clientBuildNumber=&clientId=&dsid=${self.dsid}`,
				{
					"apns-token": "APNSTOKENLMAOXD",
					"apps": [{
						"bundle-id": "com.apple.Safari",
						"kvstore-id": "com.apple.Safari.SyncedTabs",
						"registry-version": registry_version,
						"keys": [ value ]
					}],
					"service-id": "iOS"
				})
		},
		async update_tabs(tabs) {
			if(!self.dsid) throw "must validate or authenticate"

			let [keys, registry_version] = await self.get_registry_keys()

			let keyName = self.deviceUUID
			let keyValue = tabs ? {
				"DeviceName": self.deviceName,
				"Capabilities": { "CloseTabRequest": false },
				"DictionaryType": "Device",
				"LastModified": `/Date(${Date.now()})/`,
				"Tabs": tabs
			} : null
			await self.update_registry_key(registry_version, keyName, keyValue)
		},
		async authenticate(login, password) {
			let authenticate = await send_json_request(
				"https://setup.icloud.com/setup/ws/1/login?clientBuildNumber=&clientId=",
				{ apple_id: login, password: password, extended_login: true })
			if(authenticate.error) {
				self.dsid = null
				throw authenticate.error
			}
			self.dsid = authenticate.dsInfo.dsid
			return true
		},
		async validate() {
			let validate = await send_json_request("https://setup.icloud.com/setup/ws/1/validate?clientBuildNumber=&clientId=", {})
			if(validate.error) {
				self.dsid = null
				return false
			}
			self.dsid = validate.dsInfo.dsid
			return true
		}
	}
	return self
})()
