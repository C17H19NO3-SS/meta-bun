#include "../../src/cpp/network/bridge_client.h"
#include <iostream>
#include <thread>
#include <chrono>

int main() {
    std::cout << "[C++ Client] Initializing bridge client..." << std::endl;
    BridgeClient client;
    
    // Register message callback
    client.RegisterCallback([](const std::string& msg) {
        std::cout << "[C++ Client] Received message from Bun: " << msg << std::endl;
    });

    // Start connecting to port 12399 (without token)
    if (!client.Start("127.0.0.1", 12399, "")) {
        std::cerr << "[C++ Client] Failed to start client threads." << std::endl;
        return 1;
    }

    std::cout << "[C++ Client] Connecting to Bun..." << std::endl;
    
    // Wait until connected (timeout after 5 seconds)
    int attempts = 0;
    while (!client.IsConnected() && attempts < 50) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
        attempts++;
    }

    if (!client.IsConnected()) {
        std::cerr << "[C++ Client] Connection timeout." << std::endl;
        return 1;
    }

    std::cout << "[C++ Client] Connected! Sending PlayerConnect event..." << std::endl;
    
    // Send PlayerConnect event
    std::string connectPayload = "{\"event\":\"PlayerConnect\",\"client\":1,\"name\":\"CppProcessTester\",\"steamid\":\"STEAM_0:0:9876\",\"userid\":98,\"isBot\":false,\"language\":\"en\"}";
    client.Send(connectPayload);

    // Sleep 1 second to allow connection processing and bypass anti-flood cooldown (0.75s)
    std::this_thread::sleep_for(std::chrono::seconds(1));

    std::cout << "[C++ Client] Sending PlayerChat command event..." << std::endl;
    
    // Send PlayerChat event representing command
    std::string chatPayload = "{\"event\":\"PlayerChat\",\"client\":1,\"text\":\"!test_cpp_command cppVal1 cppVal2\"}";
    client.Send(chatPayload);

    // Sleep to allow Bun to process command and send any response back
    std::this_thread::sleep_for(std::chrono::milliseconds(500));

    std::cout << "[C++ Client] Shutting down..." << std::endl;
    client.Stop();
    std::cout << "[C++ Client] Exiting with success." << std::endl;
    return 0;
}
