import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import { getValidLanguage, removeFileIfExists } from "./utils";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

const allowedOrigins = [process.env.FRONTEND_ROUTE || "http://localhost:3000"];
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Configurar upload de arquivos com multer
const upload = multer({ dest: "uploads/" });

// Instanciar cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ message: "Hello World!" });
});

app.post(
  "/",
  upload.single("request_video"),
  async (req: Request, res: Response) => {
    const id = uuidv4();
    const videoFile = req.file;
    const language = getValidLanguage(req.body.language);

    if (!videoFile) {
      return res.status(400).json({ message: "Arquivo de vídeo não enviado" });
    }

    const videoPath = videoFile.path;
    const audioPath = `uploads/${id}.mp3`;

    try {
      // Extract and save audio from video
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .output(audioPath)
          .noVideo()
          .on("end", () => resolve())
          .on("error", reject)
          .run();
      });

      const transcriptionResponse = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: fs.createReadStream(audioPath),
        language,
        timestamp_granularities: ["segment"],
        response_format: "verbose_json",
      });

      const analysisResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente especializado em análise de textos. Forneça resumos, insights e análises detalhadas do conteúdo.",
          },
          {
            role: "user",
            content: `
              Analise o seguinte texto extraído de um vídeo e forneça:
              1. Um resumo breve do conteúdo.
              2. O tom do texto (ex: formal, casual, educativo, etc.).
              3. O tipo de texto (ex: notícia, artigo científico, poema, canção, etc.).
              4. Quaisquer emoções predominantes detectadas no texto.
              5. Pontos principais ou tópicos abordados.
  
              Texto: "${transcriptionResponse.text}"
            `,
          },
        ],
      });
      const analysis = analysisResponse.choices[0].message.content;

      res.status(200).json({ ...transcriptionResponse, analysis });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Falha ao tentar transcrever áudio" });
    } finally {
      await removeFileIfExists(audioPath);
      await removeFileIfExists(videoPath);
    }
  }
);

app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
