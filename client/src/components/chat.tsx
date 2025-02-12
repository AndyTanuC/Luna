import { Button } from "@/components/ui/button";
import {
    ChatBubble,
    ChatBubbleMessage,
    ChatBubbleTimestamp,
} from "@/components/ui/chat/chat-bubble";
import { ChatInput } from "@/components/ui/chat/chat-input";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { cn, moment } from "@/lib/utils";
import { IAttachment } from "@/types";
import { Content, UUID } from "@elizaos/core";
import { animated, useTransition } from "@react-spring/web";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AIWriter from "react-aiwriter";
import CopyButton from "./copy-button";
import { Avatar, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import ChatTtsButton from "./ui/chat/chat-tts-button";

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

function formatString(input: string) {
    return input
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char: string) => char.toUpperCase());
}

const renderCallId = (call: ContractCall) => {
    return `${formatString(call.id)} successfully done`;
};

export default function Page({ agentId }: { agentId: UUID }) {
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

    const getMessageVariant = (role: string) =>
        role !== "user" ? "received" : "sent";

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
    };

    const executeCall = async (call: ContractCall | ContractCall[]) => {
        try {
            if (Array.isArray(call)) {
                // Execute all calls together as a multi-call
                const tx = await sendAsync(
                    call.map((c) => ({
                        contractAddress: c.contractAddress,
                        calldata: c.calldata,
                        entrypoint: c.entrypoint,
                    }))
                );

                if (tx.transaction_hash) {
                    toast({
                        title: "Transaction sent!",
                        description: !Array.isArray(call)
                            ? `${renderCallId(call)}`
                            : `All transactions sent successfully`,
                    });

                    sendTransactionMutation.mutate(call.map((c) => c.id));
                }

                // After multi-call succeeds, process any chained calls
                for (const singleCall of call) {
                    if (singleCall.nextCalls?.length) {
                        await sleep(10000); // Wait before processing chained calls
                        await executeCall(singleCall.nextCalls);
                    }
                }
            } else {
                const { nextCalls = [], id, ...rest } = call;

                // Execute single call
                const tx = await sendAsync([rest]);

                if (tx.transaction_hash) {
                    toast({
                        title: "Transaction sent!",
                        description: `${renderCallId(call)}`,
                    });

                    sendTransactionMutation.mutate([id]);
                }
                // Process chained calls if any
                if (nextCalls.length > 0) {
                    await sleep(10000);
                    await executeCall(nextCalls);
                }
            }
        } catch (error) {
            console.error("Failed to execute contract call:", call, error);
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

        for (const call of contractCalls) {
            await executeCall(call);
        }
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
        <div className="flex flex-col w-full h-full">
            <div className="flex-1 overflow-y-auto">
                <ChatMessageList ref={messagesContainerRef}>
                    {transitions((styles, message) => {
                        const variant = getMessageVariant(message?.user);
                        return (
                            <AnimatedDiv
                                style={styles}
                                className="flex flex-col gap-1.5 p-2 sm:p-4"
                            >
                                <ChatBubble
                                    variant={variant}
                                    className="flex flex-row items-start gap-2 max-w-[85vw] break-words"
                                >
                                    {message?.user !== "user" ? (
                                        <Avatar className="size-6 sm:size-8 p-1 border rounded-full select-none shrink-0">
                                            <AvatarImage src="/elizaos-icon.png" />
                                        </Avatar>
                                    ) : null}
                                    <div className="flex flex-col overflow-hidden">
                                        <ChatBubbleMessage
                                            isLoading={message?.isLoading}
                                            className="text-sm sm:text-base break-words"
                                        >
                                            {message?.user !== "user" ? (
                                                <AIWriter>
                                                    {message?.text}
                                                </AIWriter>
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
                                                                src={
                                                                    attachment.url
                                                                }
                                                                width="100%"
                                                                height="100%"
                                                                className="w-64 rounded-md"
                                                            />
                                                            <div className="flex items-center justify-between gap-4">
                                                                <span></span>
                                                                <span></span>
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </ChatBubbleMessage>
                                        <div className="flex items-center gap-2 justify-between w-full mt-1">
                                            {message?.text &&
                                            !message?.isLoading ? (
                                                <div className="flex items-center gap-1">
                                                    <CopyButton
                                                        text={message?.text}
                                                    />
                                                    <ChatTtsButton
                                                        agentId={agentId}
                                                        text={message?.text}
                                                    />
                                                </div>
                                            ) : null}
                                            <div
                                                className={cn([
                                                    message?.isLoading
                                                        ? "mt-2"
                                                        : "",
                                                    "flex items-center justify-between gap-2 select-none text-xs",
                                                ])}
                                            >
                                                {message?.source ? (
                                                    <Badge variant="outline">
                                                        {message.source}
                                                    </Badge>
                                                ) : null}
                                                {message?.action ? (
                                                    <Badge variant="outline">
                                                        {message.action}
                                                    </Badge>
                                                ) : null}
                                                {message?.createdAt ? (
                                                    <ChatBubbleTimestamp
                                                        timestamp={moment(
                                                            message?.createdAt
                                                        ).format("LT")}
                                                    />
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                </ChatBubble>
                            </AnimatedDiv>
                        );
                    })}
                </ChatMessageList>
            </div>
            <div className="p-2 sm:p-4">
                <form
                    ref={formRef}
                    onSubmit={handleSendMessage}
                    className="relative rounded-md border bg-card"
                >
                    {selectedFile ? (
                        <div className="p-3 flex">
                            <div className="relative rounded-md border p-2">
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
                    <ChatInput
                        ref={inputRef}
                        onKeyDown={handleKeyDown}
                        value={input}
                        onChange={({ target }) => setInput(target.value)}
                        placeholder="Ask your questions explorer..."
                        className="min-h-10 text-base sm:text-base resize-none rounded-md bg-card border-0 p-2 sm:p-3 shadow-none focus-visible:ring-0"
                        style={{ fontSize: "16px" }} // This prevents iOS zoom
                    />
                    <div className="flex items-center p-2 sm:p-3 pt-0">
                        <Button
                            disabled={!input || sendMessageMutation?.isPending}
                            type="submit"
                            size="sm"
                            className="bg-red-500 w-full ml-auto gap-1.5 h-[30px] text-xs sm:text-sm"
                        >
                            {sendMessageMutation?.isPending
                                ? "..."
                                : "Send Message"}
                            <Send className="size-3 sm:size-3.5" />
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
