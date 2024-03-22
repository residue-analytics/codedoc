#!/usr/bin/env bash

# Function to start servers based on environment (dev or prod)
start_servers() {
  if [[ "${1}" == "dev" ]]; then
    echo "Starting FastAPI webserver in development mode..."
    python ./serve.py --port 8000 --html ./html/src --useHTTPS --workers 2
  else
    echo "Starting PlantUML server..."
    nohup java -jar plantuml-lgpl-1.2024.0.jar -picoweb:8888:127.0.0.1 &
    
    echo "Starting FastAPI webserver in production mode..."
    python ./serve.py --port 9999 --html ./html --workers 4
  fi
}

# Function to check if the server is running and display its status along with any child processes
check_server_status() {
  local pattern="$1"
  local main_pid=$(pgrep -f "$pattern")
  
  if [[ -n "$main_pid" ]]; then
    echo "Process [${pattern}] is running with Main PID: $main_pid"

    # Get all child PIDs using pgrep command
    local child_pids=$(pgrep -P "$main_pid")
    
    # Check if there are any child PIDs found
    if [[ -n "$child_pids" ]]; then
      echo "Child Processes:"
      # List all child PIDs using ps command
      echo "$child_pids" | xargs ps -f --pid
    else 
      echo "No Child Processes Found for [${pattern}]."
    fi
    
    return 0 # Server is running
  else
    echo "${pattern} server is not running."
    return 1 # Server is not running
  fi
}

# Function to stop the server gracefully using SIGTERM signal and wait for all children.
stop_server() {
  local pattern="$1"
  local main_pid=$(pgrep -f "$pattern")

  if [[ -n "$main_pid" ]]; then
    local child_pids=$(pgrep -P "$main_pid")
    
    # Send SIGTERM signal to allow graceful shutdown.
    kill "$main_pid"
    
    echo "Sent termination signal to [${pattern}] Main PID: $main_pid"

    # Wait for main process to terminate.
    while kill -0 "$main_pid" &>/dev/null; do 
      sleep 1 
    done

    echo "Main [${pattern}] process stopped."

    # Now check for any remaining child processes.
    for pid in $child_pids; do 
      while kill -0 "$pid" &>/dev/null; do 
        sleep 1 
      done

      echo "Stopped Child PID: $pid"
    done
     
  else 
    echo "No [${pattern}] process found."
  fi 
}

# Main logic based on user input

case "${1}" in 
status)
   check_server_status 'serve.py'
   check_server_status 'plantuml'
   ;;
stop)
   stop_server 'serve.py'
   stop_server 'plantuml'
   ;;
start)
   if [ $# !=2 ] || { [ "${2}" != "dev" ] && [ "${2}" != "" ]; }; then
     echo >&2 "Usage when starting: nohup ${0} start [dev] &"
     exit
   fi

   if [ -n "${2}" ]; then
     source ./config.env.${2}
   else
     source ./config.env
   fi

   source $VENV_LOC

   start_servers "${2}"
   ;;
*)
   echo >&2 "Usage: nohup ${0} {start|status|stop} [environment] &"
   exit
esac

exit $?

