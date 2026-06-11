#include <stdio.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <string.h>
#include <stdarg.h>
#include <signal.h>
#include <sys/wait.h>
#include <ctype.h>
#include <algorithm>
#include "plugin.h"
#include "network_connection.pb.h"

MetaBunBridge g_MetaBunBridge;
PLUGIN_EXPOSE(MetaBunBridge, g_MetaBunBridge);

SH_DECL_HOOK3_void(IServerGameDLL, GameFrame, SH_NOATTRIB, 0, bool, bool, bool);

// Generic callback for dynamic commands
static void DynamicCommandCallback(const CCommandContext &context, const CCommand &args) {
	g_MetaBunBridge.OnDynamicCommand(context, args);
}

void MetaBunBridge::Log(const char *fmt, ...)
{
	va_list ap;
	char buffer[1024];

	va_start(ap, fmt);
	vsnprintf(buffer, sizeof(buffer), fmt, ap);
	va_end(ap);

	char finalBuffer[1280];
	snprintf(finalBuffer, sizeof(finalBuffer), "[METABUN] %s\n", buffer);

	if (ismm)
	{
		ismm->ConPrint(finalBuffer);
	}
	else
	{
		printf("%s", finalBuffer);
	}
}

bool MetaBunBridge::Load(PluginId id, ISmmAPI *ismm, char *error, size_t maxlen, bool late)
{
	PLUGIN_SAVEVARS();
	this->ismm = ismm;

	printf("[METABUN] Plugin loading (ST)... version %s\n", GetVersion());

	GET_V_IFACE_CURRENT(GetEngineFactory, engine, IVEngineServer, INTERFACEVERSION_VENGINESERVER);
	GET_V_IFACE_CURRENT(GetServerFactory, gameclients, IServerGameClients, INTERFACEVERSION_SERVERGAMECLIENTS);
	GET_V_IFACE_CURRENT(GetServerFactory, server, IServerGameDLL, INTERFACEVERSION_SERVERGAMEDLL);
	GET_V_IFACE_CURRENT(GetEngineFactory, icvar, ICvar, CVAR_INTERFACE_VERSION);

	if (!engine)
	{
		snprintf(error, maxlen, "Failed to get IVEngineServer interface");
		return false;
	}

	if (!gameclients)
	{
		snprintf(error, maxlen, "Failed to get IServerGameClients interface");
		return false;
	}

	if (!server)
	{
		snprintf(error, maxlen, "Failed to get IServerGameDLL interface");
		return false;
	}

	if (!icvar)
	{
		snprintf(error, maxlen, "Failed to get ICvar interface");
		return false;
	}

	// Initialize global pointer for SDK
	g_pCVar = icvar;

	SH_ADD_HOOK(ICvar, DispatchConCommand, icvar, SH_MEMBER(this, &MetaBunBridge::Hook_DispatchConCommand), false);
	SH_ADD_HOOK(IServerGameDLL, GameFrame, server, SH_MEMBER(this, &MetaBunBridge::OnGameFrame), true);

	m_ListenSocket = -1;
	m_ClientSocket = -1;
	m_Connected = false;
	m_BunPid = -1;

	StartServer();
	SpawnBun();

	printf("[METABUN] Plugin loaded successfully.\n");

	return true;
}

bool MetaBunBridge::Unload(char *error, size_t maxlen)
{
	printf("[METABUN] Plugin unloading...\n");
	
	StopBun();
	Disconnect();
	
	if (m_ListenSocket != -1)
	{
		close(m_ListenSocket);
		m_ListenSocket = -1;
	}

	SH_REMOVE_HOOK(ICvar, DispatchConCommand, icvar, SH_MEMBER(this, &MetaBunBridge::Hook_DispatchConCommand), false);
	SH_REMOVE_HOOK(IServerGameDLL, GameFrame, server, SH_MEMBER(this, &MetaBunBridge::OnGameFrame), true);

	// Unregister and delete dynamic commands
	{
		for (auto const& [name, cmd] : m_DynamicCommands) {
			icvar->UnregisterConCommandCallbacks(cmd->ref);
			delete cmd;
		}
		m_DynamicCommands.clear();
	}

	return true;
}

static std::string ToLower(const std::string& str) {
	std::string lower = str;
	std::transform(lower.begin(), lower.end(), lower.begin(), [](unsigned char c){ return std::tolower(c); });
	return lower;
}

void MetaBunBridge::Hook_DispatchConCommand(ConCommandRef cmd, const CCommandContext &ctx, const CCommand &args)
{
	// Aggressively poll bridge on any command dispatch
	UpdateBridge();

	if (!m_Connected || !cmd.IsValidRef())
	{
		RETURN_META(MRES_IGNORED);
	}

	std::string cmdName = ToLower(cmd.GetName());
	bool isChat = (cmdName == "say" || cmdName == "say_team");
	int slot = ctx.GetPlayerSlot().Get();
	int userid = 0;

	if (slot != -1) {
		userid = engine->GetPlayerUserId(ctx.GetPlayerSlot()).Get();
	}

	std::vector<uint8_t> buffer;
	auto PackInt = [&buffer](uint32_t value) {
		if (value <= 127) {
			buffer.push_back((uint8_t)value);
		} else if (value <= 0xFF) {
			buffer.push_back(0xcc);
			buffer.push_back((uint8_t)value);
		} else if (value <= 0xFFFF) {
			buffer.push_back(0xcd);
			buffer.push_back((uint8_t)(value >> 8));
			buffer.push_back((uint8_t)value);
		} else {
			buffer.push_back(0xce);
			buffer.push_back((uint8_t)(value >> 24));
			buffer.push_back((uint8_t)(value >> 16));
			buffer.push_back((uint8_t)(value >> 8));
			buffer.push_back((uint8_t)value);
		}
	};
	auto PackString = [&buffer](const std::string& str) {
		size_t len = str.length();
		if (len < 32) buffer.push_back(0xa0 | (uint8_t)len);
		else { buffer.push_back(0xd9); buffer.push_back((uint8_t)len); }
		buffer.insert(buffer.end(), str.begin(), str.end());
	};

	if (isChat)
	{
		bool teamOnly = (cmdName == "say_team");
		std::string text = "";
		if (args.ArgC() > 1) {
			text = args.ArgS();
		}

		// Strip quotes if any (Source 2 includes them in ArgS for say)
		if (!text.empty() && text[0] == '"') {
			text = text.substr(1);
			if (!text.empty() && text.back() == '"') text.pop_back();
		}

		bool silent = false;
		if (!text.empty()) {
			if (text[0] == '/') {
				silent = true;
			} else if (text[0] == '!') {
				// Extract command name for silent lookup
				size_t spacePos = text.find(' ');
				std::string cmdNamePart = (spacePos == std::string::npos) ? text.substr(1) : text.substr(1, spacePos - 1);
				std::string lowerCmd = ToLower(cmdNamePart);
				
				auto it = m_DynamicCommands.find(lowerCmd);
				if (it != m_DynamicCommands.end()) {
					if (it->second->bSilent) {
						silent = true;
					}
				} else {
					// Also check with sm_ prefix
					std::string smCmd = "sm_" + lowerCmd;
					auto itSm = m_DynamicCommands.find(smCmd);
					if (itSm != m_DynamicCommands.end()) {
						if (itSm->second->bSilent) {
							silent = true;
						}
					}
				}
			}
		}

		buffer.push_back(0x85); // map(5)
		PackString("action"); PackString("chat_cmd");
		PackString("userid"); PackInt(userid);
		PackString("text"); PackString(text);
		PackString("teamOnly"); buffer.push_back(teamOnly ? 0xc3 : 0xc2);
		PackString("silent"); buffer.push_back(silent ? 0xc3 : 0xc2);

		Send(buffer.data(), buffer.size());

		if (silent)
		{
			RETURN_META(MRES_SUPERCEDE);
		}
	}
	else
	{
		// Forward ALL other console commands to Bun
		buffer.push_back(0x83); // map(3)
		PackString("action"); PackString("console_cmd");
		PackString("userid"); PackInt(userid);
		PackString("args");
		int arrSize = args.ArgC();
		if (arrSize <= 15) buffer.push_back(0x90 | (uint8_t)arrSize);
		else { buffer.push_back(0xdc); buffer.push_back((uint8_t)(arrSize >> 8)); buffer.push_back((uint8_t)arrSize); }
		for (int i = 0; i < args.ArgC(); i++) {
			PackString(args[i]);
		}

		Send(buffer.data(), buffer.size());
	}

	RETURN_META(MRES_IGNORED);
}

void MetaBunBridge::OnDynamicCommand(const CCommandContext &context, const CCommand &args)
{
	// With DispatchConCommand hooked, we don't strictly need this callback,
	// but it doesn't hurt as a fallback or if we stop hooking Dispatch.
	// For now, let's keep it empty to avoid duplicate events in Bun.
}

static uint64 flagsToRemove = (FCVAR_HIDDEN | FCVAR_DEVELOPMENTONLY);
static void UnlockConVars() {
	for (ConVarRefAbstract ref(ConVarRef((uint16)0)); ref.IsValidRef(); ref = ConVarRefAbstract(ConVarRef(ref.GetAccessIndex() + 1))) {
		if (ref.IsFlagSet(flagsToRemove)) ref.RemoveFlags(flagsToRemove);
	}
}

void MetaBunBridge::AllPluginsLoaded()
{
	UnlockConVars();
}

void MetaBunBridge::StartServer()
{
	printf("[METABUN] Starting bridge server on 127.0.0.1:27013...\n");

	m_ListenSocket = socket(AF_INET, SOCK_STREAM, 0);
	if (m_ListenSocket == -1)
	{
		printf("[METABUN] Failed to create socket: %s\n", strerror(errno));
		return;
	}

	// Set non-blocking
	int flags = fcntl(m_ListenSocket, F_GETFL, 0);
	fcntl(m_ListenSocket, F_SETFL, flags | O_NONBLOCK);

	int opt = 1;
	setsockopt(m_ListenSocket, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

	struct sockaddr_in address;
	address.sin_family = AF_INET;
	address.sin_addr.s_addr = inet_addr("127.0.0.1");
	address.sin_port = htons(27013);

	if (bind(m_ListenSocket, (struct sockaddr *)&address, sizeof(address)) < 0)
	{
		printf("[METABUN] Bind failed: %s\n", strerror(errno));
		close(m_ListenSocket);
		m_ListenSocket = -1;
		return;
	}

	if (listen(m_ListenSocket, 3) < 0)
	{
		printf("[METABUN] Listen failed: %s\n", strerror(errno));
		close(m_ListenSocket);
		m_ListenSocket = -1;
		return;
	}
}

void MetaBunBridge::SpawnBun()
{
	printf("[METABUN] Spawning Bun process...\n");

	m_BunPid = fork();
	if (m_BunPid == 0)
	{
		char rootPath[1024];
		snprintf(rootPath, sizeof(rootPath), "%s/addons/meta-bun", ismm->GetBaseDir());
		
		char binPath[1024];
		snprintf(binPath, sizeof(binPath), "%s/bin/bun", rootPath);

		if (chdir(rootPath) != 0) exit(1);

		char *argv[] = {binPath, (char *)"run", (char *)"index.js", NULL};
		execv(binPath, argv);
		
		char *fallbackArgv[] = {(char *)"bun", (char *)"run", (char *)"index.js", NULL};
		execvp("bun", fallbackArgv);
		exit(1);
	}
	else if (m_BunPid < 0)
	{
		printf("[METABUN] Failed to fork Bun process: %s\n", strerror(errno));
	}
	else
	{
		printf("[METABUN] Bun process spawned with PID: %d\n", m_BunPid);
	}
}

void MetaBunBridge::StopBun()
{
	if (m_BunPid > 0)
	{
		kill(m_BunPid, SIGTERM);
		int status;
		for (int i = 0; i < 10; i++) {
			pid_t res = waitpid(m_BunPid, &status, WNOHANG);
			if (res != 0) break;
			usleep(100000); // 100ms
		}
		if (waitpid(m_BunPid, &status, WNOHANG) == 0) {
			kill(m_BunPid, SIGKILL);
			waitpid(m_BunPid, &status, 0);
		}
		m_BunPid = -1;
	}
}

void MetaBunBridge::Disconnect()
{
	m_Connected = false;
	if (m_ClientSocket != -1)
	{
		shutdown(m_ClientSocket, SHUT_RDWR);
		close(m_ClientSocket);
		m_ClientSocket = -1;
	}
}

void MetaBunBridge::Send(const uint8_t *data, uint32_t size)
{
	if (!m_Connected || m_ClientSocket == -1) return;

	uint32_t networkSize = htonl(size);
	if (send(m_ClientSocket, &networkSize, 4, 0) == -1) {
		Disconnect();
		return;
	}
	if (send(m_ClientSocket, data, size, 0) == -1) {
		Disconnect();
		return;
	}
}

void MetaBunBridge::SendAction(const char *action, const char *extraKey, const char *extraValue)
{
	std::vector<uint8_t> buffer;
	bool hasExtra = (extraKey != nullptr && extraValue != nullptr);
	buffer.push_back(hasExtra ? 0x82 : 0x81);
	buffer.push_back(0xa6); buffer.insert(buffer.end(), {'a','c','t','i','o','n'});
	size_t actionLen = strlen(action);
	buffer.push_back(0xa0 | (uint8_t)actionLen);
	buffer.insert(buffer.end(), action, action + actionLen);
	if (hasExtra)
	{
		size_t kLen = strlen(extraKey);
		buffer.push_back(0xa0 | (uint8_t)kLen);
		buffer.insert(buffer.end(), extraKey, extraKey + kLen);
		size_t vLen = strlen(extraValue);
		if (vLen < 32) buffer.push_back(0xa0 | (uint8_t)vLen);
		else { buffer.push_back(0xd9); buffer.push_back((uint8_t)vLen); }
		buffer.insert(buffer.end(), extraValue, extraValue + vLen);
	}
	Send(buffer.data(), buffer.size());
}

void MetaBunBridge::UpdateBridge()
{
	if (m_ListenSocket == -1) return;

	// Accept new connections
	if (!m_Connected)
	{
		struct sockaddr_in address;
		int addrlen = sizeof(address);
		int newSocket = accept(m_ListenSocket, (struct sockaddr *)&address, (socklen_t*)&addrlen);
		if (newSocket >= 0)
		{
			// Set client socket to non-blocking
			int flags = fcntl(newSocket, F_GETFL, 0);
			fcntl(newSocket, F_SETFL, flags | O_NONBLOCK);

			m_ClientSocket = newSocket;
			m_Connected = true;
			printf("[METABUN] Bun client connected!\n");
		}
	}

	// Receive data
	if (m_Connected && m_ClientSocket != -1)
	{
		while (true)
		{
			uint8_t buffer[4096];
			ssize_t bytesRead = recv(m_ClientSocket, buffer, sizeof(buffer), 0);
			if (bytesRead > 0)
			{
				m_ReceiveBuffer.insert(m_ReceiveBuffer.end(), buffer, buffer + bytesRead);
				while (m_ReceiveBuffer.size() >= 4)
				{
					uint32_t length = ntohl(*(uint32_t *)m_ReceiveBuffer.data());
					if (m_ReceiveBuffer.size() >= 4 + length)
					{
						ProcessMessage(m_ReceiveBuffer.data() + 4, length);
						m_ReceiveBuffer.erase(m_ReceiveBuffer.begin(), m_ReceiveBuffer.begin() + 4 + length);
					}
					else break;
				}
			}
			else if (bytesRead == 0)
			{
				printf("[METABUN] Bun client disconnected (EOF).\n");
				Disconnect();
				break;
			}
			else if (bytesRead == -1)
			{
				if (errno != EWOULDBLOCK && errno != EAGAIN && errno != EINTR)
				{
					printf("[METABUN] Bun client disconnected (Error: %s).\n", strerror(errno));
					Disconnect();
				}
				break;
			}
		}
	}
}

void MetaBunBridge::ProcessMessage(const uint8_t *data, uint32_t size)
{
	if (size < 1) return;

	uint32_t pos = 0;
	uint8_t type = data[pos++];
	uint32_t mapSize = 0;
	
	// MessagePack Map Parsing
	if (type >= 0x80 && type <= 0x8f) mapSize = type & 0x0f;
	else if (type == 0xde) { 
		if (pos + 2 > size) return;
		mapSize = (data[pos] << 8) | data[pos+1]; pos += 2; 
	}
	else if (type == 0xdf) { 
		if (pos + 4 > size) return;
		mapSize = (data[pos] << 24) | (data[pos+1] << 16) | (data[pos+2] << 8) | data[pos+3]; pos += 4; 
	}
	else return;

	bool silent = false;
	std::string action = "";
	std::string cmd = "";
	int userid = -1;
	std::string reason = "";
	int damage = 0;
	std::string message = "";
	std::string name = "";
	std::string description = "";
	std::string value = "";
	int flags = 0;

	for (uint32_t i = 0; i < mapSize; i++) {
		if (pos >= size) break;
		
		std::string key = "";
		uint8_t kType = data[pos++];
		uint32_t kLen = 0;
		if (kType >= 0xa0 && kType <= 0xbf) kLen = kType & 0x1f;
		else if (kType == 0xd9) { 
			if (pos >= size) return;
			kLen = data[pos++]; 
		}
		else if (kType == 0xda) { 
			if (pos + 2 > size) return;
			kLen = (data[pos] << 8) | data[pos+1]; pos += 2; 
		}
		else return;
		
		if (pos + kLen > size) return;
		key = std::string((const char*)&data[pos], kLen);
		pos += kLen;
		
		if (pos >= size) return;
		uint8_t vType = data[pos++];
		
		if ((vType >= 0xa0 && vType <= 0xbf) || vType == 0xd9 || vType == 0xda) {
			uint32_t vLen = 0;
			if (vType >= 0xa0 && vType <= 0xbf) vLen = vType & 0x1f;
			else if (vType == 0xd9) { 
				if (pos >= size) return;
				vLen = data[pos++]; 
			}
			else if (vType == 0xda) { 
				if (pos + 2 > size) return;
				vLen = (data[pos] << 8) | data[pos+1]; pos += 2; 
			}
			if (pos + vLen > size) return;
			std::string valStr = std::string((const char*)&data[pos], vLen);
			pos += vLen;
			if (key == "action") action = valStr;
			else if (key == "cmd") cmd = valStr;
			else if (key == "reason") reason = valStr;
			else if (key == "message") message = valStr;
			else if (key == "name") name = valStr;
			else if (key == "description") description = valStr;
			else if (key == "value") value = valStr;
		} 
		else if (vType <= 0x7f || vType >= 0xe0 || vType == 0xcc || vType == 0xcd || vType == 0xce) {
			int valInt = 0;
			if (vType <= 0x7f) valInt = vType;
			else if (vType >= 0xe0) valInt = (int8_t)vType;
			else if (vType == 0xcc) { 
				if (pos >= size) return;
				valInt = data[pos++]; 
			}
			else if (vType == 0xcd) { 
				if (pos + 2 > size) return;
				valInt = (data[pos] << 8) | data[pos+1]; pos += 2; 
			}
			else if (vType == 0xce) { 
				if (pos + 4 > size) return;
				valInt = (data[pos] << 24) | (data[pos+1] << 16) | (data[pos+2] << 8) | data[pos+3]; pos += 4; 
			}
			if (key == "userid") userid = valInt;
			else if (key == "damage") damage = valInt;
			else if (key == "flags") flags = valInt;
		}
		else if (vType == 0xc2 || vType == 0xc3) {
			bool valBool = (vType == 0xc3);
			if (key == "silent") silent = valBool;
		}
	}
	
	if (action == "server_cmd") {
		if (!cmd.empty()) {
			engine->ServerCommand(cmd.c_str());
		}
	} 
	else if (action == "auth") {
		SendAction("auth_success");
	}
	else if (action == "register_command") {
		if (!name.empty()) {
			std::string lowerName = ToLower(name);
			if (m_DynamicCommands.find(lowerName) == m_DynamicCommands.end())
			{
				MetaBunCommand* bunCmd = new MetaBunCommand();
				bunCmd->name = lowerName;
				bunCmd->help = description.empty() ? "MetaBun Command" : description;
				bunCmd->bSilent = silent;
				
				ConCommandCreation_t setup;
				setup.m_pszName = bunCmd->name.c_str();
				setup.m_pszHelpString = bunCmd->help.c_str();
				setup.m_nFlags = flags;
				setup.m_CBInfo = ConCommandCallbackInfo_t(DynamicCommandCallback);
				
				bunCmd->ref = icvar->RegisterConCommand(setup);
				m_DynamicCommands[bunCmd->name] = bunCmd;
				printf("[METABUN] Registered command: %s\n", bunCmd->name.c_str());
			}
		}
	}
	else if (action == "unregister_command") {
		if (!name.empty()) {
			std::string lowerName = ToLower(name);
			auto it = m_DynamicCommands.find(lowerName);
			if (it != m_DynamicCommands.end())
			{
				icvar->UnregisterConCommandCallbacks(it->second->ref);
				delete it->second;
				m_DynamicCommands.erase(it);
				printf("[METABUN] Unregistered command: %s\n", lowerName.c_str());
			}
		}
	}
	else if (action == "print") {
		if (!message.empty()) Log("%s", message.c_str());
	}
	else if (action == "say") {
		if (!message.empty()) {
			char cmdBuf[1280];
			snprintf(cmdBuf, sizeof(cmdBuf), "say %s", message.c_str());
			engine->ServerCommand(cmdBuf);
		}
	}
	else if (action == "kick_client") {
		if (userid != -1) {
			for (int i = 0; i < 64; i++) {
				CPlayerSlot slot(i);
				if (engine->GetPlayerUserId(slot).Get() == userid) {
					engine->DisconnectClient(slot, NETWORK_DISCONNECT_KICKED, reason.c_str());
					break;
				}
			}
		}
	}
	else if (action == "cvar_set") {
		if (!name.empty()) {
			ConVarRef ref = icvar->FindConVar(name.c_str());
			if (ref.IsValidRef()) {
				ConVarRefAbstract abstractRef(ref);
				abstractRef.SetString(value.c_str(), CSplitScreenSlot(0));
			}
		}
	}
}

bool MetaBunBridge::Pause(char *error, size_t maxlen) { return true; }
bool MetaBunBridge::Unpause(char *error, size_t maxlen) { return true; }
const char *MetaBunBridge::GetAuthor() { return "MetaBun Team"; }
const char *MetaBunBridge::GetName() { return "MetaBun Bridge"; }
const char *MetaBunBridge::GetDescription() { return "TypeScript/Bun bridge for Metamod:Source"; }
const char *MetaBunBridge::GetURL() { return "https://github.com/meta-bun/meta-bun"; }
const char *MetaBunBridge::GetLicense() { return "MIT"; }
const char *MetaBunBridge::GetVersion() { return "1.0.0"; }
const char *MetaBunBridge::GetDate() { return __DATE__; }
const char *MetaBunBridge::GetLogTag() { return "METABUN"; }

void MetaBunBridge::OnGameFrame(bool simulating, bool bFirstTick, bool bLastTick)
{
	UpdateBridge();
}
