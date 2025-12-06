cmake_minimum_required(VERSION 3.10)
project(phi3-service)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find threads library
find_package(Threads REQUIRED)

# Add executable
add_executable(phi3-server src/server.cpp)

# Link libraries
target_link_libraries(phi3-server Threads::Threads)

# Installation
install(TARGETS phi3-server DESTINATION bin)
