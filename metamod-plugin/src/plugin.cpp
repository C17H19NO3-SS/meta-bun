#include <stdio.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <string.h>
#include "plugin.h"

MetaBunBridge g_MetaBunBridge;
PLUGIN_EXPOSE(MetaBunBridge, g_MetaBunBridge);

bool MetaBunBridge::Load(PluginId id, ISmmAPI *ismm, char *error, size_t maxlen, bool late)
{
	PLUGIN_SAVEVARS();

	GET_V_IFACE_CURRENT(GetEngineFactory, engine, IVEngineServer, INTERFACEVERSION_VENGINESERVER);

	SH_ADD_HOOK(IVEngineServer, ClientCommand, engine, SH_MEMBER(this, &MetaBunBridge::Hook_ClientCommand), false);

	m_Socket = -1;
	m_Connected = false;
	m_ShouldExit = false;

	Connect();

	return true;
}

bool MetaBunBridge::Unload(char *error, size_t maxlen)
{
	SH_REMOVE_HOOK(IVEngineServer, ClientCommand, engine, SH_MEMBER(this, &MetaBunBridge::Hook_ClientCommand), false);

	m_ShouldExit = true;
	Disconnect();
	if (m_ReceiveThread.joinable())
	{
		m_ReceiveThread.join();
	}
	return true;
}

void MetaBunBridge::Hook_ClientCommand(edict_t *pEntity)
{
	if (!m_Connected)
	{
		RETURN_META(MRES_IGNORED);
	}

	int client = ismm->IndexOfEdict(pEntity);
	const char *cmd = engine->Cmd_Argv(0);
	const char *args = engine->Cmd_Args();

	bool isSay = strcmp(cmd, "say") == 0;
	bool isSayTeam = strcmp(cmd, "say_team") == 0;

	if (isSay || isSayTeam)
	{
		// Format as msgpack: {"event": "PlayerChat", "client": client, "text": args, "team_only": bool}
		std::vector<uint8_t> buffer;
		buffer.push_back(0x84); // map with 4 elements

		// "event" -> "PlayerChat"
		buffer.push_back(0xa5);
		const char *kEvent = "event";
		for (int i = 0; i < 5; i++) buffer.push_back(kEvent[i]);
		const char *vEvent = "PlayerChat";
		buffer.push_back(0xaa);
		for (int i = 0; i < 10; i++) buffer.push_back(vEvent[i]);

		// "client" -> int
		buffer.push_back(0xa6);
		const char *kClient = "client";
		for (int i = 0; i < 6; i++) buffer.push_back(kClient[i]);
		buffer.push_back((uint8_t)client);

		// "text" -> string (args)
		buffer.push_back(0xa4);
		const char *kText = "text";
		for (int i = 0; i < 4; i++) buffer.push_back(kText[i]);
		size_t argsLen = strlen(args);
		if (argsLen < 32) buffer.push_back(0xa0 | (uint8_t)argsLen);
		else { buffer.push_back(0xd9); buffer.push_back((uint8_t)argsLen); }
		for (size_t i = 0; i < argsLen; i++) buffer.push_back(args[i]);

		// "team_only" -> bool
		buffer.push_back(0xa9);
		const char *kTeam = "team_only";
		for (int i = 0; i < 9; i++) buffer.push_back(kTeam[i]);
		buffer.push_back(isSayTeam ? 0xc3 : 0xc2);

		Send(buffer.data(), buffer.size());
	}

	// Format as msgpack: {"event": "PlayerCommand", "client": client, "cmd": cmd, "args": args}
	std::vector<uint8_t> buffer;
	buffer.push_back(0x84); // map with 4 elements

	// "event" -> "PlayerCommand"
	buffer.push_back(0xa5);
	const char *kEvent = "event";
	for (int i = 0; i < 5; i++) buffer.push_back(kEvent[i]);
	const char *vEvent = "PlayerCommand";
	buffer.push_back(0xad);
	for (int i = 0; i < 13; i++) buffer.push_back(vEvent[i]);

	// "client" -> int
	buffer.push_back(0xa6);
	const char *kClient = "client";
	for (int i = 0; i < 6; i++) buffer.push_back(kClient[i]);
	buffer.push_back((uint8_t)client); // Assuming index < 127

	// "cmd" -> string
	buffer.push_back(0xa3);
	const char *kCmd = "cmd";
	for (int i = 0; i < 3; i++) buffer.push_back(kCmd[i]);
	size_t cmdLen = strlen(cmd);
	buffer.push_back(0xa0 | (uint8_t)cmdLen);
	for (size_t i = 0; i < cmdLen; i++) buffer.push_back(cmd[i]);

	// "args" -> string
	buffer.push_back(0xa4);
	const char *kArgs = "args";
	for (int i = 0; i < 4; i++) buffer.push_back(kArgs[i]);
	size_t argsLen = strlen(args);
	if (argsLen < 32) buffer.push_back(0xa0 | (uint8_t)argsLen);
	else { buffer.push_back(0xd9); buffer.push_back((uint8_t)argsLen); }
	for (size_t i = 0; i < argsLen; i++) buffer.push_back(args[i]);

	Send(buffer.data(), buffer.size());

	RETURN_META(MRES_IGNORED);
}


void MetaBunBridge::AllPluginsLoaded()
{
}

void MetaBunBridge::Connect()
{
	if (m_Connected) return;

	m_Socket = socket(AF_INET, SOCK_STREAM, 0);
	if (m_Socket == -1) return;

	struct sockaddr_in serv_addr;
	memset(&serv_addr, 0, sizeof(serv_addr));
	serv_addr.sin_family = AF_INET;
	serv_addr.sin_port = htons(27013);
	inet_pton(AF_INET, "127.0.0.1", &serv_addr.sin_addr);

	if (connect(m_Socket, (struct sockaddr *)&serv_addr, sizeof(serv_addr)) < 0)
	{
		close(m_Socket);
		m_Socket = -1;
		return;
	}

	m_Connected = true;
	printf("[METABUN] Connected to Bun server at 127.0.0.1:27013\n");

	m_ReceiveThread = std::thread(&MetaBunBridge::ReceiveThread, this);
}

void MetaBunBridge::Disconnect()
{
	m_Connected = false;
	if (m_Socket != -1)
	{
		// Force close to break blocking recv
		shutdown(m_Socket, SHUT_RDWR);
		close(m_Socket);
		m_Socket = -1;
	}
}

void MetaBunBridge::Send(const uint8_t *data, uint32_t size)
{
	if (!m_Connected || m_Socket == -1) return;

	uint32_t networkSize = htonl(size);
	if (send(m_Socket, &networkSize, 4, 0) == -1) {
		Disconnect();
		return;
	}
	if (send(m_Socket, data, size, 0) == -1) {
		Disconnect();
		return;
	}
}

void MetaBunBridge::SendAction(const char *action, const char *extraKey, const char *extraValue)
{
	std::vector<uint8_t> buffer;
	
	// Map of 1 or 2
	bool hasExtra = (extraKey != nullptr && extraValue != nullptr);
	buffer.push_back(hasExtra ? 0x82 : 0x81);

	// "action" key
	buffer.push_back(0xa6);
	const char *keyAction = "action";
	for (int i = 0; i < 6; i++) buffer.push_back(keyAction[i]);

	// action value
	size_t actionLen = strlen(action);
	buffer.push_back(0xa0 | (uint8_t)actionLen);
	for (size_t i = 0; i < actionLen; i++) buffer.push_back(action[i]);

	if (hasExtra)
	{
		// extraKey
		size_t kLen = strlen(extraKey);
		buffer.push_back(0xa0 | (uint8_t)kLen);
		for (size_t i = 0; i < kLen; i++) buffer.push_back(extraKey[i]);

		// extraValue
		size_t vLen = strlen(extraValue);
		if (vLen < 32)
		{
			buffer.push_back(0xa0 | (uint8_t)vLen);
		}
		else
		{
			buffer.push_back(0xd9);
			buffer.push_back((uint8_t)vLen);
		}
		for (size_t i = 0; i < vLen; i++) buffer.push_back(extraValue[i]);
	}

	Send(buffer.data(), buffer.size());
}

void MetaBunBridge::ReceiveThread()
{
	std::vector<uint8_t> receiveBuffer;

	while (!m_ShouldExit && m_Connected)
	{
		uint8_t buffer[4096];
		ssize_t bytesRead = recv(m_Socket, buffer, sizeof(buffer), 0);

		if (bytesRead > 0)
		{
			receiveBuffer.insert(receiveBuffer.end(), buffer, buffer + bytesRead);

			while (receiveBuffer.size() >= 4)
			{
				uint32_t length = ntohl(*(uint32_t *)receiveBuffer.data());
				if (receiveBuffer.size() >= 4 + length)
				{
					ProcessMessage(receiveBuffer.data() + 4, length);
					receiveBuffer.erase(receiveBuffer.begin(), receiveBuffer.begin() + 4 + length);
				}
				else
				{
					break;
				}
			}
		}
		else if (bytesRead == 0 || (bytesRead == -1 && errno != EINTR))
		{
			m_Connected = false;
			break;
		}
	}

	if (!m_ShouldExit) {
		printf("[METABUN] Disconnected from Bun server\n");
	}
}

void MetaBunBridge::ProcessMessage(const uint8_t *data, uint32_t size)
{
	if (size < 1) return;

	uint32_t offset = 0;
	uint8_t type = data[offset++];

	// Expecting a map (fixmap 0x80-0x8f)
	if ((type & 0xf0) == 0x80) {
		uint8_t mapSize = type & 0x0f;
		std::string action = "";
		std::string cmd = "";

		for (uint8_t i = 0; i < mapSize; i++) {
			if (offset >= size) break;

			// Key
			uint8_t kType = data[offset++];
			uint32_t kLen = 0;
			if ((kType & 0xe0) == 0xa0) { // fixstr
				kLen = kType & 0x1f;
			} else if (kType == 0xd9) { // str 8
				if (offset >= size) break;
				kLen = data[offset++];
			} else {
				return;
			}
			
			if (offset + kLen > size) break;
			std::string key((const char *)&data[offset], kLen);
			offset += kLen;

			// Value
			if (offset >= size) break;
			uint8_t vType = data[offset++];
			uint32_t vLen = 0;
			if ((vType & 0xe0) == 0xa0) { // fixstr
				vLen = vType & 0x1f;
			} else if (vType == 0xd9) { // str 8
				if (offset >= size) break;
				vLen = data[offset++];
			} else if (vType == 0xda) { // str 16
				if (offset + 2 > size) break;
				vLen = ntohs(*(uint16_t *)&data[offset]);
				offset += 2;
			} else {
				continue;
			}

			if (offset + vLen > size) break;
			std::string val((const char *)&data[offset], vLen);
			offset += vLen;

			if (key == "action") {
				action = val;
			} else if (key == "cmd") {
				cmd = val;
			}
		}

		if (action == "command" && !cmd.empty()) {
			engine->ServerCommand(cmd.c_str());
		}
	}
}

bool MetaBunBridge::Pause(char *error, size_t maxlen)
{
	return true;
}

bool MetaBunBridge::Unpause(char *error, size_t maxlen)
{
	return true;	
}

const char *MetaBunBridge::GetAuthor()
{
	return "MetaBun Team";
}

const char *MetaBunBridge::GetName()
{
	return "MetaBun Bridge";
}

const char *MetaBunBridge::GetDescription()
{
	return "TypeScript/Bun bridge for Metamod:Source";
}

const char *MetaBunBridge::GetURL()
{
	return "https://github.com/meta-bun/meta-bun";
}

const char *MetaBunBridge::GetLicense()
{
	return "MIT";
}

const char *MetaBunBridge::GetVersion()
{
	return "1.0.0";
}

const char *MetaBunBridge::GetDate()
{
	return __DATE__;
}

const char *MetaBunBridge::GetLogTag()
{
	return "METABUN";
}
