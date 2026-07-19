#!/bin/bash

# =====================================================
# Aegis - Chaos Engineering Scripts
# Inject failures to test self-healing capabilities
# =====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICES=("aegis-service-a" "aegis-service-b" "aegis-service-c")
LOG_FILE="logs/chaos-log.json"

# Helper function to log chaos events
log_chaos() {
    local type=$1
    local target=$2
    local message=$3
    
    echo -e "${YELLOW}[CHAOS]${NC} $type on $target: $message"
    
    # Append to log file
    mkdir -p logs
    echo "{\"timestamp\":\"$(date -Iseconds)\",\"type\":\"$type\",\"target\":\"$target\",\"message\":\"$message\"}" >> "$LOG_FILE"
}

# Kill a random container
kill_random_container() {
    local target=${SERVICES[$RANDOM % ${#SERVICES[@]}]}
    log_chaos "KILL" "$target" "Killing container"
    docker kill "$target" 2>/dev/null || echo "Container $target not running"
}

# Kill a specific container
kill_container() {
    local target=$1
    log_chaos "KILL" "$target" "Killing container"
    docker kill "$target" 2>/dev/null || echo "Container $target not running"
}

# Throttle memory for a container
throttle_memory() {
    local target=$1
    local limit=${2:-128m}
    log_chaos "MEMORY_THROTTLE" "$target" "Limiting memory to $limit"
    docker update --memory "$limit" "$target" 2>/dev/null || echo "Failed to update $target"
}

# Inject latency via service endpoint
inject_latency() {
    local service=$1
    local latency=${2:-1000}
    local port
    
    case $service in
        "aegis-service-a") port=3001 ;;
        "aegis-service-b") port=3002 ;;
        "aegis-service-c") port=3003 ;;
        *) echo "Unknown service: $service"; return 1 ;;
    esac
    
    log_chaos "LATENCY" "$service" "Injecting ${latency}ms latency"
    curl -s -X POST "http://localhost:$port/chaos/latency" \
        -H "Content-Type: application/json" \
        -d "{\"ms\": $latency}" || echo "Failed to inject latency"
}

# Inject failure via service endpoint
inject_failure() {
    local service=$1
    local port
    
    case $service in
        "aegis-service-a") port=3001 ;;
        "aegis-service-b") port=3002 ;;
        "aegis-service-c") port=3003 ;;
        *) echo "Unknown service: $service"; return 1 ;;
    esac
    
    log_chaos "FAILURE" "$service" "Enabling simulated failure"
    curl -s -X POST "http://localhost:$port/chaos/failure" \
        -H "Content-Type: application/json" \
        -d '{"enabled": true}' || echo "Failed to inject failure"
}

# Inject memory leak
inject_memory_leak() {
    local service=$1
    local size=${2:-5000000}
    local port
    
    case $service in
        "aegis-service-a") port=3001 ;;
        "aegis-service-b") port=3002 ;;
        "aegis-service-c") port=3003 ;;
        *) echo "Unknown service: $service"; return 1 ;;
    esac
    
    log_chaos "MEMORY_LEAK" "$service" "Injecting memory leak (size: $size)"
    curl -s -X POST "http://localhost:$port/chaos/memory-leak" \
        -H "Content-Type: application/json" \
        -d "{\"size\": $size}" || echo "Failed to inject memory leak"
}

# Reset all chaos settings
reset_chaos() {
    echo -e "${GREEN}Resetting all chaos settings...${NC}"
    
    for service in "${SERVICES[@]}"; do
        local port
        case $service in
            "aegis-service-a") port=3001 ;;
            "aegis-service-b") port=3002 ;;
            "aegis-service-c") port=3003 ;;
        esac
        
        curl -s -X POST "http://localhost:$port/chaos/reset" \
            -H "Content-Type: application/json" 2>/dev/null || true
    done
    
    log_chaos "RESET" "all" "All chaos settings reset"
    echo -e "${GREEN}Done!${NC}"
}

# Run a chaos scenario
run_scenario() {
    local scenario=$1
    
    case $scenario in
        "cascade")
            echo -e "${BLUE}Running cascade failure scenario...${NC}"
            inject_latency "aegis-service-a" 2000
            sleep 5
            inject_failure "aegis-service-b"
            sleep 5
            kill_container "aegis-service-c"
            ;;
        "memory")
            echo -e "${BLUE}Running memory exhaustion scenario...${NC}"
            inject_memory_leak "aegis-service-a" 10000000
            sleep 10
            inject_memory_leak "aegis-service-a" 10000000
            ;;
        "random")
            echo -e "${BLUE}Running random failure scenario...${NC}"
            local target=${SERVICES[$RANDOM % ${#SERVICES[@]}]}
            local failure_type=$((RANDOM % 3))
            
            case $failure_type in
                0) kill_container "$target" ;;
                1) inject_latency "$target" 3000 ;;
                2) inject_failure "$target" ;;
            esac
            ;;
        *)
            echo "Unknown scenario: $scenario"
            echo "Available scenarios: cascade, memory, random"
            return 1
            ;;
    esac
}

# Interactive menu
show_menu() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}      ${YELLOW}Aegis Chaos Engineering Toolkit${NC}       ${BLUE}║${NC}"
    echo -e "${BLUE}╠════════════════════════════════════════════╣${NC}"
    echo -e "${BLUE}║${NC} 1) Kill random container                   ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC} 2) Kill specific container                 ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC} 3) Inject latency                          ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC} 4) Inject failure                          ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC} 5) Inject memory leak                      ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC} 6) Run scenario                            ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC} 7) Reset all chaos                         ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC} 8) Show system status                      ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC} 0) Exit                                    ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
    echo ""
}

# Show system status
show_status() {
    echo -e "${BLUE}System Status:${NC}"
    echo "----------------------------------------"
    
    for service in "${SERVICES[@]}"; do
        local status=$(docker inspect --format='{{.State.Status}}' "$service" 2>/dev/null || echo "not found")
        local color=$GREEN
        [[ "$status" != "running" ]] && color=$RED
        echo -e "  $service: ${color}$status${NC}"
    done
    
    echo ""
    echo -e "${BLUE}Monitor Status:${NC}"
    curl -s http://localhost:4000/health 2>/dev/null | head -1 || echo "  Monitor not available"
    
    echo ""
    echo -e "${BLUE}Healer Status:${NC}"
    curl -s http://localhost:4001/status 2>/dev/null | head -1 || echo "  Healer not available"
}

# Main script
main() {
    if [[ $# -eq 0 ]]; then
        # Interactive mode
        while true; do
            show_menu
            read -p "Select option: " choice
            
            case $choice in
                1) kill_random_container ;;
                2) 
                    echo "Available: ${SERVICES[*]}"
                    read -p "Container name: " container
                    kill_container "$container"
                    ;;
                3)
                    echo "Available services: service-a, service-b, service-c"
                    read -p "Service: " service
                    read -p "Latency (ms): " latency
                    inject_latency "aegis-$service" "$latency"
                    ;;
                4)
                    echo "Available services: service-a, service-b, service-c"
                    read -p "Service: " service
                    inject_failure "aegis-$service"
                    ;;
                5)
                    echo "Available services: service-a, service-b, service-c"
                    read -p "Service: " service
                    read -p "Size (default 5000000): " size
                    inject_memory_leak "aegis-$service" "${size:-5000000}"
                    ;;
                6)
                    echo "Available scenarios: cascade, memory, random"
                    read -p "Scenario: " scenario
                    run_scenario "$scenario"
                    ;;
                7) reset_chaos ;;
                8) show_status ;;
                0) 
                    echo "Exiting..."
                    exit 0
                    ;;
                *) echo -e "${RED}Invalid option${NC}" ;;
            esac
            
            echo ""
            read -p "Press Enter to continue..."
        done
    else
        # Command line mode
        case $1 in
            "kill") kill_container "$2" ;;
            "latency") inject_latency "$2" "$3" ;;
            "failure") inject_failure "$2" ;;
            "memory") inject_memory_leak "$2" "$3" ;;
            "scenario") run_scenario "$2" ;;
            "reset") reset_chaos ;;
            "status") show_status ;;
            *)
                echo "Usage: $0 [command] [args]"
                echo ""
                echo "Commands:"
                echo "  kill <container>        - Kill a container"
                echo "  latency <service> <ms>  - Inject latency"
                echo "  failure <service>       - Enable failure mode"
                echo "  memory <service> <size> - Inject memory leak"
                echo "  scenario <name>         - Run a chaos scenario"
                echo "  reset                   - Reset all chaos"
                echo "  status                  - Show system status"
                echo ""
                echo "Run without arguments for interactive mode"
                ;;
        esac
    fi
}

main "$@"
