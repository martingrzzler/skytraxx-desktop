package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
)

func main() {
	folderToServe := flag.String("folder", ".", "Folder to serve files from")
	flag.Parse()
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		filePath := filepath.Join(*folderToServe, r.URL.Path)

		// Open the file
		file, err := os.Open(filePath)
		if err != nil {
			http.Error(w, "File not found.", http.StatusNotFound)
			return
		}
		defer file.Close()

		// Get file info
		fileInfo, err := file.Stat()
		if err != nil {
			http.Error(w, "File not found.", http.StatusNotFound)
			return
		}

		// Set Content-Length header
		w.Header().Set("Content-Length", strconv.FormatInt(fileInfo.Size(), 10))
		w.Header().Set("Access-Control-Allow-Origin", "*")

		// Serve the file
		http.ServeFile(w, r, filePath)
	})

	log.Printf("Serving files from %s on http://localhost:8080\n", *folderToServe)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
