import { Button } from "@/components/ui/button";
import {
    ChatBubble,
    ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import { ChatInput } from "@/components/ui/chat/chat-input";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { IAttachment } from "@/types";
import { Content, UUID } from "@elizaos/core";
import { animated, useTransition } from "@react-spring/web";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AIWriter from "react-aiwriter";
import { Avatar, AvatarImage } from "./ui/avatar";

interface ExtraContentFields {
    user: string;
    createdAt: number;
    isLoading?: boolean;
}

type ContractCall = {
    id: string;
    contractAddress: string;
    calldata: string[];
    entrypoint: string;
    nextCalls?: ContractCall[];
};

type ContentWithUser = Content & ExtraContentFields;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface PageProps {
    agentId: UUID;
    onSendMessage?: (e: React.FormEvent<HTMLFormElement>) => void;
}

export default function Page({ agentId, onSendMessage }: PageProps) {
    const { toast } = useToast();
    const { address } = useAccount();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [input, setInput] = useState("");
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    // const fileInputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const queryClient = useQueryClient();

    const { sendAsync, error } = useSendTransaction({
        calls: [],
    });

    useEffect(() => {
        if (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Failed to send transaction",
                description: error.message,
            });
        }
    }, [error]);

    // const getMessageVariant = (role: string) =>
    //     role !== "user" ? "received" : "sent";

    const scrollToBottom = () => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop =
                messagesContainerRef.current.scrollHeight;
        }
    };
    useEffect(() => {
        scrollToBottom();
    }, [queryClient.getQueryData(["messages", agentId])]);

    useEffect(() => {
        scrollToBottom();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            handleSendMessage(e as unknown as React.FormEvent<HTMLFormElement>);
        }
    };

    const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input) return;

        const attachments: IAttachment[] | undefined = selectedFile
            ? [
                  {
                      url: URL.createObjectURL(selectedFile),
                      contentType: selectedFile.type,
                      title: selectedFile.name,
                  },
              ]
            : undefined;

        const newMessages = [
            {
                text: input,
                user: "user",
                createdAt: Date.now(),
                attachments,
            },
            {
                text: input,
                user: "system",
                isLoading: true,
                createdAt: Date.now(),
            },
        ];

        queryClient.setQueryData(
            ["messages", agentId],
            (old: ContentWithUser[] = []) => [...old, ...newMessages]
        );

        sendMessageMutation.mutate({
            message: input,
            selectedFile: selectedFile ? selectedFile : null,
        });

        setSelectedFile(null);
        setInput("");
        formRef.current?.reset();
        onSendMessage?.(e);
    };

    const executeCall = async (calls: ContractCall[]) => {
        try {
            if (calls.length) {
                // Execute all calls together as a multi-call
                const groupedCalls = calls.map((c) => ({
                    contractAddress: c.contractAddress,
                    calldata: c.calldata,
                    entrypoint: c.entrypoint,
                }));

                // Send all calls in a single transaction
                const tx = await sendAsync(groupedCalls);

                if (tx.transaction_hash) {
                    toast({
                        title: "Transaction sent!",
                        description: "All transactions sent successfully",
                    });

                    await sleep(3000);

                    // Process all call IDs together
                    sendTransactionMutation.mutate(calls.map((c) => c.id));
                }
            }
        } catch (error) {
            console.error("Failed to execute contract call:", calls, error);
            toast({
                variant: "destructive",
                title: "Contract call failed",
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        }
    };

    const handleContractCall = async (contractCalls: ContractCall[]) => {
        console.log("Handle Contract Calls", contractCalls);

        await executeCall(contractCalls);
    };

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const sendTransactionMutation = useMutation({
        mutationKey: ["send_transaction", agentId],
        mutationFn: (callIds: string[]) =>
            apiClient.sendTransaction(agentId, callIds, address),
        onSuccess: (newMessages: ContentWithUser[]) => {
            queryClient.setQueryData(
                ["messages", agentId],
                (old: ContentWithUser[] = []) => [
                    ...old.filter((msg) => !msg.isLoading),
                    ...newMessages.map((msg) => ({
                        ...msg,
                        createdAt: Date.now(),
                    })),
                ]
            );
        },
    });
    const sendMessageMutation = useMutation({
        mutationKey: ["send_message", agentId],
        mutationFn: ({
            message,
            selectedFile,
        }: {
            message: string;
            selectedFile?: File | null;
        }) => apiClient.sendMessage(agentId, message, selectedFile, address),
        onSuccess: (newMessages: ContentWithUser[]) => {
            queryClient.setQueryData(
                ["messages", agentId],
                (old: ContentWithUser[] = []) => [
                    ...old.filter((msg) => !msg.isLoading),
                    ...newMessages.map((msg) => ({
                        ...msg,
                        createdAt: Date.now(),
                    })),
                ]
            );

            for (const msg of newMessages) {
                if (msg.contractCalls) {
                    handleContractCall(msg.contractCalls as ContractCall[]);
                }
            }
        },
        onError: (e) => {
            toast({
                variant: "destructive",
                title: "Unable to send message",
                description: e.message,
            });
        },
    });

    // const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    //     const file = e.target.files?.[0];
    //     if (file && file.type.startsWith("image/")) {
    //         setSelectedFile(file);
    //     }
    // };

    const messages =
        queryClient.getQueryData<ContentWithUser[]>(["messages", agentId]) ||
        [];

    const transitions = useTransition(messages, {
        keys: (message) =>
            `${message.createdAt}-${message.user}-${message.text}`,
        from: { opacity: 0, transform: "translateY(50px)" },
        enter: { opacity: 1, transform: "translateY(0px)" },
        leave: { opacity: 0, transform: "translateY(10px)" },
    });

    // Add this type
    const AnimatedDiv = animated("div");

    return (
        <div className="absolute inset-0 flex flex-col">
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <ChatMessageList ref={messagesContainerRef}>
                    {transitions((styles, message) => (
                        <AnimatedDiv
                            style={styles}
                            className="flex flex-col w-full mb-8"
                        >
                            <ChatBubble
                                variant="received"
                                className="flex items-start gap-2 w-full"
                            >
                                <Avatar className="size-8 rounded-full overflow-hidden shrink-0 border-2 border-white/10 mt-2">
                                    <AvatarImage
                                        src={
                                            message?.user === "user"
                                                ? "/revenant.png"
                                                : "/luna_open.png"
                                        }
                                        alt={
                                            message?.user === "user"
                                                ? "Revenant"
                                                : "Luna"
                                        }
                                        className="object-cover"
                                    />
                                </Avatar>

                                <div className="flex flex-col w-full overflow-hidden rounded-2xl">
                                    <ChatBubbleMessage
                                        isLoading={message?.isLoading}
                                        className="text-base text-white/90 bg-transparent break-words chat-message"
                                    >
                                        {message?.user !== "user" ? (
                                            <AIWriter>{message?.text}</AIWriter>
                                        ) : (
                                            message?.text
                                        )}
                                        {/* Attachments */}
                                        <div>
                                            {message?.attachments?.map(
                                                (attachment, idx) => (
                                                    <div
                                                        className="flex flex-col gap-1 mt-2"
                                                        key={idx}
                                                    >
                                                        <img
                                                            src={attachment.url}
                                                            width="100%"
                                                            height="100%"
                                                            className="max-w-[256px] rounded-md"
                                                        />
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </ChatBubbleMessage>
                                </div>
                            </ChatBubble>
                        </AnimatedDiv>
                    ))}
                </ChatMessageList>
            </div>
            <div className="relative p-2 sm:p-4 bg-background">
                <form
                    ref={formRef}
                    onSubmit={handleSendMessage}
                    className="relative"
                >
                    <div className="relative flex items-center border border-white/10 rounded-lg bg-black/50 backdrop-blur">
                        <ChatInput
                            ref={inputRef}
                            onKeyDown={handleKeyDown}
                            value={input}
                            onChange={({ target }) => setInput(target.value)}
                            placeholder="Message Luna..."
                            className="min-h-[44px] w-full text-base text-white/90 resize-none rounded-lg bg-transparent border-0 p-3 pr-12 shadow-none focus-visible:ring-0"
                            style={{ fontSize: "16px" }}
                        />
                        <Button
                            disabled={!input || sendMessageMutation?.isPending}
                            type="submit"
                            size="icon"
                            className="absolute right-2 bg-transparent hover:bg-white/10 text-white/90"
                        >
                            <Send className="size-5" />
                        </Button>
                    </div>
                    {selectedFile ? (
                        <div className="absolute -top-20 left-0 p-3">
                            <div className="relative rounded-md border border-white/10 p-2 bg-black/50">
                                <Button
                                    onClick={() => setSelectedFile(null)}
                                    className="absolute -right-2 -top-2 size-[22px] ring-2 ring-background"
                                    variant="outline"
                                    size="icon"
                                >
                                    <X />
                                </Button>
                                <img
                                    src={URL.createObjectURL(selectedFile)}
                                    height="100%"
                                    width="100%"
                                    className="aspect-square object-contain w-16"
                                />
                            </div>
                        </div>
                    ) : null}
                </form>
            </div>
        </div>
    );
}
