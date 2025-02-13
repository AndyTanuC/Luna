import { z } from "zod";

interface TextResponse {
    text: string;
}

export const TextResponseSchema = z.object({
    text: z.string(),
});

export const isTextResponse = (obj: any): obj is TextResponse => {
    return TextResponseSchema.safeParse(obj).success;
};
