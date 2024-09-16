import Head from "next/head";
import { ChangeEvent, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkedSlider } from "@/components/ui/linkedslider";
import { Textarea } from "@/components/ui/textarea";
import essay from "@/lib/essay";

const DEFAULT_CHUNK_SIZE = 1024;
const DEFAULT_CHUNK_OVERLAP = 20;
const DEFAULT_TOP_K = 2;
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_TOP_P = 1;

export default function Home() {
  const answerId = useId();
  const queryId = useId();
  const sourceId = useId();
  const [text, setText] = useState(essay);
  const [query, setQuery] = useState("List the name, description, and personality of every character in the following format:\n\nName: [name]\nDescription: [description]\nPersonality: [personality]\n");
  const [needsNewIndex, setNeedsNewIndex] = useState(true);
  const [buildingIndex, setBuildingIndex] = useState(false);
  const [runningQuery, setRunningQuery] = useState(false);
  const [nodesWithEmbedding, setNodesWithEmbedding] = useState([]);
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE.toString());
  const [chunkOverlap, setChunkOverlap] = useState(DEFAULT_CHUNK_OVERLAP.toString());
  const [topK, setTopK] = useState(DEFAULT_TOP_K.toString());
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE.toString());
  const [topP, setTopP] = useState(DEFAULT_TOP_P.toString());
  const [answer, setAnswer] = useState("");
  const [tableHtml, setTableHtml] = useState(""); // State for table HTML

  const generateTable = (responseString: string) => {
    const characterSections = responseString.split('\n\n');
    const characters = characterSections.map((section: string) => {
      const lines = section.split('\n');
      const name = lines[0].replace('Name: ', '');
      const description = lines[1].replace('Description: ', '');
      const personality = lines[2].replace('Personality: ', '');
      return { name, description, personality };
    });

    let table = '<table border="1"><tr><th>Name</th><th>Description</th><th>Personality</th></tr>';
    characters.forEach((character: { name: any; description: any; personality: any; }) => {
      table += `<tr><td>${character.name}</td><td>${character.description}</td><td>${character.personality}</td></tr>`;
    });
    table += '</table>';

    return table;
  };

  return (
    <>
      <Head>
        <title>LlamaIndex.TS Playground</title>
      </Head>
      <main className="mx-2 flex h-full flex-col lg:mx-56">
        <div className="space-y-2">
          <Label>Settings:</Label>
          <div>
            <LinkedSlider
              label="Chunk Size:"
              description={
                "The maximum size of the chunks we are searching over, in tokens. " +
                "The bigger the chunk, the more likely that the information you are looking " +
                "for is in the chunk, but also the more likely that the chunk will contain " +
                "irrelevant information."
              }
              min={1}
              max={3000}
              step={1}
              value={chunkSize}
              onChange={(value: string) => {
                setChunkSize(value);
                setNeedsNewIndex(true);
              }}
            />
          </div>
          <div>
            <LinkedSlider
              label="Chunk Overlap:"
              description={
                "The maximum amount of overlap between chunks, in tokens. " +
                "Overlap helps ensure that sufficient contextual information is retained."
              }
              min={1}
              max={600}
              step={1}
              value={chunkOverlap}
              onChange={(value: string) => {
                setChunkOverlap(value);
                setNeedsNewIndex(true);
              }}
            />
          </div>
        </div>

        {/* File input for uploading text files */}
        <div className="my-2 flex h-3/4 flex-auto flex-col space-y-2">
          <Label htmlFor={sourceId}>Upload source text file:</Label>
          <Input
            id={sourceId}
            type="file"
            accept=".txt"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const fileContent = event.target?.result as string;
                  setText(fileContent);
                  setNeedsNewIndex(true);
                };
                if (file.type !== "text/plain") {
                  console.error(`${file.type} parsing not implemented`);
                  setText("Error");
                } else {
                  reader.readAsText(file);
                }
              }
            }}
          />
        </div>

        {/* Display the uploaded text */}
        {text && (
          <Textarea
            value={text}
            readOnly
            placeholder="File contents will appear here"
            className="flex-1"
          />
        )}

        <Button
          disabled={!needsNewIndex || buildingIndex || runningQuery}
          onClick={async () => {
            setAnswer("Building index...");
            setBuildingIndex(true);
            setNeedsNewIndex(false);
            const result = await fetch("/api/splitandembed", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                document: text,
                chunkSize: parseInt(chunkSize),
                chunkOverlap: parseInt(chunkOverlap),
              }),
            });
            const { error, payload } = await result.json();

            if (error) {
              setAnswer(error);
            }

            if (payload) {
              setNodesWithEmbedding(payload.nodesWithEmbedding);
              setAnswer("Index built!");
            }

            setBuildingIndex(false);
          }}
        >
          {buildingIndex ? "Building Vector index..." : "Build index"}
        </Button>

        {!buildingIndex && !needsNewIndex && !runningQuery && (
          <>
            <LinkedSlider
              className="my-2"
              label="Top K:"
              description={
                "The maximum number of chunks to return from the search. " +
                "It's called Top K because we are retrieving the K nearest neighbors of the query."
              }
              min={1}
              max={15}
              step={1}
              value={topK}
              onChange={(value: string) => {
                setTopK(value);
              }}
            />

            <LinkedSlider
              className="my-2"
              label="Temperature:"
              description={
                "Temperature controls the variability of model response. Adjust it " +
                "downwards to get more consistent responses, and upwards to get more diversity."
              }
              min={0}
              max={1}
              step={0.01}
              value={temperature}
              onChange={(value: string) => {
                setTemperature(value);
              }}
            />

            <LinkedSlider
              className="my-2"
              label="Top P:"
              description={
                "Top P is another way to control the variability of the model " +
                "response. It filters out low probability options for the model. It's " +
                "recommended by OpenAI to set temperature to 1 if you're adjusting " +
                "the top P."
              }
              min={0}
              max={1}
              step={0.01}
              value={topP}
              onChange={(value: string) => {
                setTopP(value);
              }}
            />

            <div className="my-2 space-y-2">
              <Label htmlFor={queryId}>Query:</Label>
              <div className="flex w-full space-x-2">
                <Input
                  id={queryId}
                  value={query}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setQuery(e.target.value);
                  }}
                />
                <Button
                  type="submit"
                  disabled={needsNewIndex || buildingIndex || runningQuery}
                  onClick={async () => {
                    setAnswer("Running query...");
                    setRunningQuery(true);
                    const result = await fetch("/api/retrieveandquery", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        query,
                        nodesWithEmbedding,
                        topK: parseInt(topK),
                        temperature: parseFloat(temperature),
                        topP: parseFloat(topP),
                      }),
                    });

                    const { error, payload } = await result.json();

                    if (error) {
                      setAnswer(error);
                    }

                    if (payload) {
                      // Generate and set table HTML
                      const table = generateTable(payload.response);
                      setTableHtml(table);
                      setAnswer(""); // Clear the answer text
                    }

                    setRunningQuery(false);
                  }}
                >
                  Submit
                </Button>
              </div>
            </div>

            <div className="my-2 flex h-1/4 flex-auto flex-col space-y-2">
              <Label htmlFor={answerId}>Answer:</Label>
              <Textarea
                className="flex-1"
                readOnly
                value={answer}
                id={answerId}
              />
            </div>

            {/* Display the generated table */}
            <div className="my-2">
              <div dangerouslySetInnerHTML={{ __html: tableHtml }} />
            </div>
          </>
        )}
      </main>
    </>
  );
}
