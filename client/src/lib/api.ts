import { type Character, type UUID } from "@elizaos/core";

const BASE_URL = "http://localhost:3111";
// const BASE_URL =
//     " https://e7a1-2404-8000-1004-5dfe-1131-5b0-dbae-97d2.ngrok-free.app";

const fetcher = async ({
    url,
    method,
    body,
    headers,
}: {
    url: string;
    method?: "GET" | "POST";
    body?: object | FormData;
    headers?: HeadersInit;
}) => {
    const options: RequestInit = {
        method: method ?? "GET",
        headers: headers
            ? headers
            : {
                  Accept: "application/json",
                  "Content-Type": "application/json",
              },
    };

    if (method === "POST") {
        if (body instanceof FormData) {
            // @ts-expect-error - Supressing potentially undefined options header
            delete options.headers["Content-Type"];
            options.body = body;
        } else {
            options.body = JSON.stringify(body);
        }
    }

    return fetch(`${BASE_URL}${url}`, options).then(async (resp) => {
        if (resp.ok) {
            const contentType = resp.headers.get("Content-Type");

            if (contentType === "audio/mpeg") {
                return await resp.blob();
            }
            return resp.json();
        }

        const errorText = await resp.text();
        console.error("Error: ", errorText);

        let errorMessage = "An error occurred.";
        try {
            const errorObj = JSON.parse(errorText);
            errorMessage = errorObj.message || errorMessage;
        } catch {
            errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
    });
};

export const apiClient = {
    sendMessage: (
        agentId: string,
        message: string,
        selectedFile?: File | null,
        walletAddress?: string
    ) => {
        const formData = new FormData();
        formData.append("text", message);
        formData.append("user", "user");
        if (walletAddress) {
            formData.append("walletAddress", walletAddress);
        }
        if (selectedFile) {
            formData.append("file", selectedFile);
        }
        return fetcher({
            url: `/${agentId}/message`,
            method: "POST",
            body: formData,
        });
    },
    sendTransaction: (
        agentId: string,
        callIds: string[],
        walletAddress?: string
    ) => {
        return fetcher({
            url: `/${agentId}/transaction`,
            method: "POST",
            body: { callIds, walletAddress },
        });
    },
    getAgents: () => fetcher({ url: "/agents" }),
    getAgent: (agentId: string): Promise<{ id: UUID; character: Character }> =>
        fetcher({ url: `/agents/${agentId}` }),
    tts: (agentId: string, text: string) =>
        fetcher({
            url: `/${agentId}/tts`,
            method: "POST",
            body: {
                text,
            },
            headers: {
                "Content-Type": "application/json",
                Accept: "audio/mpeg",
                "Transfer-Encoding": "chunked",
            },
        }),
    whisper: async (agentId: string, audioBlob: Blob) => {
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.wav");
        return fetcher({
            url: `/${agentId}/whisper`,
            method: "POST",
            body: formData,
        });
    },
};
