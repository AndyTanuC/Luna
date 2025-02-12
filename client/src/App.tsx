import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import useVersion from "./hooks/use-version";
import "./index.css";
import { StarknetProvider } from "./lib/starknet";
import Chat from "./routes/chat";
import Home from "./routes/home";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: Infinity,
        },
    },
});

function App() {
    useVersion();
    return (
        <StarknetProvider>
            <QueryClientProvider client={queryClient}>
                <div
                    className="dark antialiased"
                    style={{
                        colorScheme: "dark",
                    }}
                >
                    <BrowserRouter>
                        <TooltipProvider delayDuration={0}>
                            <SidebarProvider>
                                {/* <AppSidebar /> */}
                                <SidebarInset>
                                    <div className="flex flex-1 flex-col gap-4 size-full container">
                                        <Routes>
                                            <Route
                                                path="/"
                                                element={<Home />}
                                            />
                                            <Route
                                                path="chat/:agentId"
                                                element={<Chat />}
                                            />
                                            {/* <Route
                                                path="settings/:agentId"
                                                element={<Overview />}
                                            /> */}
                                        </Routes>
                                    </div>
                                </SidebarInset>
                            </SidebarProvider>
                            <Toaster />
                        </TooltipProvider>
                    </BrowserRouter>
                </div>
            </QueryClientProvider>
        </StarknetProvider>
    );
}

export default App;
