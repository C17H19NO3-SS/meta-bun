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

	m_Socket = -1;
	m_Connected = false;
	m_ShouldExit = false;

	Connect();

	return true;
}

bool MetaBunBridge::Unload(char *error, size_t maxlen)
{
	m_ShouldExit = true;
	Disconnect();
	if (m_ReceiveThread.joinable())
	{
		m_ReceiveThread.join();
	}
	return true;
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
	// TODO: Handle commands from Bun
	printf("[METABUN] Received message of size %u\n", size);
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
