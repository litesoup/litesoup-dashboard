package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"

	"github.com/litesoup/litesoup-dashboard/agent"
)

const version = "0.1.0"

func main() {
	port := flag.Int("port", 7777, "port to listen on (loopback only)")
	showVersion := flag.Bool("version", false, "print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Println("litesoup-agent", version)
		return
	}

	mux := agent.NewServer(version)
	addr := fmt.Sprintf("127.0.0.1:%d", *port)
	log.Printf("litesoup-agent %s listening on %s", version, addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
