#include <iostream>
#include <string>
#include <cstring>
#include <cstdlib>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <thread>
#include <sstream>
#include <regex>

// Simple HTTP server for Phi-3 model
// This is a placeholder implementation that would integrate with llama.cpp

class Phi3Server {
private:
    int port;
    int server_fd;
    
    std::string process_completion(const std::string& prompt) {
        // TODO: Integrate with llama.cpp and Phi-3 model
        // For now, return a simple response
        return "This is a placeholder response. In production, this would use llama.cpp with Phi-3 model to generate responses based on: " + prompt;
    }
    
    std::string extract_json_field(const std::string& json, const std::string& field) {
        std::regex pattern("\"" + field + "\"\\s*:\\s*\"([^\"]+)\"");
        std::smatch matches;
        if (std::regex_search(json, matches, pattern) && matches.size() > 1) {
            return matches[1].str();
        }
        return "";
    }
    
    void handle_request(int client_socket) {
        char buffer[4096] = {0};
        read(client_socket, buffer, 4096);
        
        std::string request(buffer);
        std::string response;
        
        // Parse HTTP request
        if (request.find("GET /health") == 0) {
            response = "HTTP/1.1 200 OK\r\n"
                      "Content-Type: application/json\r\n"
                      "Content-Length: 25\r\n"
                      "\r\n"
                      "{\"status\":\"healthy\"}";
        }
        else if (request.find("POST /completion") == 0) {
            // Extract body from request
            size_t body_start = request.find("\r\n\r\n");
            std::string body = "";
            if (body_start != std::string::npos) {
                body = request.substr(body_start + 4);
            }
            
            // Extract prompt from JSON body
            std::string prompt = extract_json_field(body, "prompt");
            
            // Process with model
            std::string completion = process_completion(prompt);
            
            // Build JSON response
            std::string json_response = "{\"response\":\"" + completion + "\"}";
            
            response = "HTTP/1.1 200 OK\r\n"
                      "Content-Type: application/json\r\n"
                      "Content-Length: " + std::to_string(json_response.length()) + "\r\n"
                      "\r\n" + json_response;
        }
        else {
            response = "HTTP/1.1 404 Not Found\r\n"
                      "Content-Length: 0\r\n"
                      "\r\n";
        }
        
        write(client_socket, response.c_str(), response.length());
        close(client_socket);
    }
    
public:
    Phi3Server(int p) : port(p), server_fd(-1) {}
    
    void start() {
        struct sockaddr_in address;
        int opt = 1;
        int addrlen = sizeof(address);
        
        // Create socket
        if ((server_fd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
            std::cerr << "Socket creation failed" << std::endl;
            exit(EXIT_FAILURE);
        }
        
        // Set socket options
        if (setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR | SO_REUSEPORT, &opt, sizeof(opt))) {
            std::cerr << "Setsockopt failed" << std::endl;
            exit(EXIT_FAILURE);
        }
        
        address.sin_family = AF_INET;
        address.sin_addr.s_addr = INADDR_ANY;
        address.sin_port = htons(port);
        
        // Bind socket
        if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
            std::cerr << "Bind failed" << std::endl;
            exit(EXIT_FAILURE);
        }
        
        // Listen
        if (listen(server_fd, 10) < 0) {
            std::cerr << "Listen failed" << std::endl;
            exit(EXIT_FAILURE);
        }
        
        std::cout << "Phi-3 server listening on port " << port << std::endl;
        
        // Accept connections
        while (true) {
            int client_socket;
            if ((client_socket = accept(server_fd, (struct sockaddr *)&address, (socklen_t*)&addrlen)) < 0) {
                std::cerr << "Accept failed" << std::endl;
                continue;
            }
            
            // Handle request in a new thread
            std::thread(&Phi3Server::handle_request, this, client_socket).detach();
        }
    }
    
    ~Phi3Server() {
        if (server_fd >= 0) {
            close(server_fd);
        }
    }
};

int main(int argc, char* argv[]) {
    int port = 11434;
    
    if (argc > 1) {
        port = std::atoi(argv[1]);
    }
    
    std::cout << "Starting Phi-3 AI Service..." << std::endl;
    
    Phi3Server server(port);
    server.start();
    
    return 0;
}
