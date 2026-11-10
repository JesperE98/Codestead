#define GLFW_INCLUDE_VULKAN
#include <GLFW/glfw3.h>

#include <iostream>
#include <stdexcept>
#include <vector>
#include <cstring>
#include <cstdlib>
#include <optional>

const uint32_t WIDTH = 800;
const uint32_t HEIGHT = 600;

// TODO: the list of validation layers and the enableValidationLayers flag

// TODO: CreateDebugUtilsMessengerEXT and DestroyDebugUtilsMessengerEXT (load the debug messenger functions)

// TODO: struct QueueFamilyIndices (the index of the graphics queue family)

class HelloTriangleApplication {
public:
    void run() {
        initWindow();
        initVulkan();
        mainLoop();
        cleanup();
    }

private:
    GLFWwindow* window;

    // TODO: the Vulkan instance (VkInstance instance)
    // TODO: the debug messenger (VkDebugUtilsMessengerEXT debugMessenger)

    // TODO: the physical device (VkPhysicalDevice physicalDevice)
    // TODO: the logical device and its graphics queue

    void initWindow() {
        glfwInit();

        glfwWindowHint(GLFW_CLIENT_API, GLFW_NO_API);
        glfwWindowHint(GLFW_RESIZABLE, GLFW_FALSE);

        window = glfwCreateWindow(WIDTH, HEIGHT, "Vulkan", nullptr, nullptr);
    }

    void initVulkan() {
        // TODO: create the Vulkan instance (createInstance)
        // TODO: set up the debug messenger (setupDebugMessenger)
        // TODO: pick a graphics card (pickPhysicalDevice)
        // TODO: create the logical device (createLogicalDevice)
    }

    void mainLoop() {
        while (!glfwWindowShouldClose(window)) {
            glfwPollEvents();
        }
    }

    void cleanup() {
        // TODO: destroy the logical device

        // TODO: destroy the debug messenger (only if validation layers are enabled)

        // TODO: destroy the Vulkan instance

        glfwDestroyWindow(window);

        glfwTerminate();
    }

    // TODO: createInstance()

    // TODO: populateDebugMessengerCreateInfo() and setupDebugMessenger()

    // TODO: pickPhysicalDevice()

    // TODO: createLogicalDevice()

    // TODO: isDeviceSuitable() and findQueueFamilies()

    // TODO: getRequiredExtensions()

    // TODO: checkValidationLayerSupport()

    // TODO: debugCallback()
};

int main() {
    HelloTriangleApplication app;

    try {
        app.run();
    } catch (const std::exception& e) {
        std::cerr << e.what() << std::endl;
        return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
}
