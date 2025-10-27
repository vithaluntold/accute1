import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { FormField, FormTemplate, FormConditionalRule } from "@shared/schema";
import { evaluateConditionalRules } from "@/lib/conditional-logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Star, Upload, Check, Mic, Video, Camera, Square, Play, RotateCcw, Loader2 } from "lucide-react";

interface MediaFieldProps {
  id: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function AudioField({ id, value, onChange, disabled }: MediaFieldProps) {
  const [mode, setMode] = useState<"upload" | "record">("upload");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopRecording();
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          onChange(reader.result as string);
          setFileName('recorded-audio.webm');
        };
        reader.readAsDataURL(blob);
        cleanup();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      setIsInitializing(false);
    } catch (err) {
      setError("Failed to access microphone. Please check permissions.");
      setIsInitializing(false);
      console.error("Audio recording error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as "upload" | "record")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" data-testid={`audio-tab-upload-${id}`}>
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="record" data-testid={`audio-tab-record-${id}`}>
            <Mic className="w-4 h-4 mr-2" />
            Record
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <div>
            <Input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              disabled={disabled}
              data-testid={`audio-upload-${id}`}
            />
            {fileName && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {fileName}
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="record" className="space-y-4">
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <Button
                type="button"
                onClick={startRecording}
                disabled={disabled || isInitializing}
                data-testid={`audio-record-${id}`}
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Start Recording
                  </>
                )}
              </Button>
            ) : (
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={stopRecording}
                  data-testid={`audio-stop-${id}`}
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Recording
                </Button>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                  <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {value && (
        <div className="space-y-2">
          <Label>Preview</Label>
          <audio
            src={value}
            controls
            className="w-full"
            data-testid={`audio-preview-${id}`}
          />
        </div>
      )}
    </div>
  );
}

function VideoField({ id, value, onChange, disabled }: MediaFieldProps) {
  const [mode, setMode] = useState<"upload" | "record">("upload");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopRecording();
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      streamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          onChange(reader.result as string);
          setFileName('recorded-video.webm');
        };
        reader.readAsDataURL(blob);
        cleanup();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      setIsInitializing(false);
    } catch (err) {
      setError("Failed to access camera/microphone. Please check permissions.");
      setIsInitializing(false);
      console.error("Video recording error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as "upload" | "record")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" data-testid={`video-tab-upload-${id}`}>
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="record" data-testid={`video-tab-record-${id}`}>
            <Video className="w-4 h-4 mr-2" />
            Record
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <div>
            <Input
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              disabled={disabled}
              data-testid={`video-upload-${id}`}
            />
            {fileName && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {fileName}
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="record" className="space-y-4">
          <div className="space-y-4">
            {isRecording && (
              <div className="relative bg-muted rounded-md overflow-hidden">
                <video
                  ref={videoPreviewRef}
                  className="w-full"
                  autoPlay
                  muted
                  data-testid={`video-live-preview-${id}`}
                />
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-1 rounded-md">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              {!isRecording ? (
                <Button
                  type="button"
                  onClick={startRecording}
                  disabled={disabled || isInitializing}
                  data-testid={`video-record-${id}`}
                >
                  {isInitializing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4 mr-2" />
                      Start Recording
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={stopRecording}
                  data-testid={`video-stop-${id}`}
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Recording
                </Button>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {value && !isRecording && (
        <div className="space-y-2">
          <Label>Preview</Label>
          <video
            src={value}
            controls
            className="w-full rounded-md"
            data-testid={`video-preview-${id}`}
          />
        </div>
      )}
    </div>
  );
}

function CameraField({ id, value, onChange, disabled }: MediaFieldProps) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const openCamera = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: false 
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsCameraOpen(true);
      setIsInitializing(false);
    } catch (err) {
      setError("Failed to access camera. Please check permissions.");
      setIsInitializing(false);
      console.error("Camera access error:", err);
    }
  };

  const captureImage = () => {
    if (!videoRef.current || !streamRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
      
      cleanup();
      setIsCameraOpen(false);
    }
  };

  const retake = () => {
    onChange('');
    openCamera();
  };

  const closeCamera = () => {
    cleanup();
    setIsCameraOpen(false);
  };

  return (
    <div className="space-y-4">
      {!isCameraOpen && !value && (
        <Button
          type="button"
          onClick={openCamera}
          disabled={disabled || isInitializing}
          data-testid={`camera-open-${id}`}
        >
          {isInitializing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Opening Camera...
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 mr-2" />
              Open Camera
            </>
          )}
        </Button>
      )}

      {isCameraOpen && (
        <div className="space-y-4">
          <div className="relative bg-muted rounded-md overflow-hidden">
            <video
              ref={videoRef}
              className="w-full"
              autoPlay
              data-testid={`camera-live-preview-${id}`}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={captureImage}
              data-testid={`camera-capture-${id}`}
            >
              <Camera className="w-4 h-4 mr-2" />
              Capture Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={closeCamera}
              data-testid={`camera-close-${id}`}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {value && !isCameraOpen && (
        <div className="space-y-2">
          <Label>Captured Photo</Label>
          <div className="relative">
            <img
              src={value}
              alt="Captured"
              className="w-full rounded-md border"
              data-testid={`camera-preview-${id}`}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={retake}
            disabled={disabled}
            data-testid={`camera-retake-${id}`}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Retake Photo
          </Button>
        </div>
      )}
    </div>
  );
}

interface FormRendererProps {
  formTemplate: FormTemplate;
  onSubmit: (data: Record<string, any>) => void;
  defaultValues?: Record<string, any>;
  isSubmitting?: boolean;
}

export function FormRenderer({ formTemplate, onSubmit, defaultValues = {}, isSubmitting = false }: FormRendererProps) {
  const fields = (formTemplate.fields as FormField[]) || [];
  const sortedFields = [...fields].sort((a, b) => (a.order || 0) - (b.order || 0));
  const conditionalRules = (formTemplate.conditionalRules as FormConditionalRule[]) || [];

  // State for conditional field visibility/requirements
  const [conditionalStates, setConditionalStates] = useState({
    hidden: new Set<string>(),
    required: new Set<string>(),
    disabled: new Set<string>(),
  });

  // Build dynamic Zod schema based on fields and conditional requirements
  const buildSchema = (condStates: typeof conditionalStates) => {
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    fields.forEach((field) => {
      // Skip hidden fields in validation
      if (condStates.hidden.has(field.id)) {
        schemaFields[field.id] = z.any().optional();
        return;
      }

      let fieldSchema: z.ZodTypeAny;
      // Check if field is required (either by field config or conditional rule)
      const isRequired = field.validation?.required || condStates.required.has(field.id);

      switch (field.type) {
        case "number":
        case "percentage":
        case "rating":
        case "slider":
          // Accept both string and number inputs, then coerce to number
          fieldSchema = z.union([z.string(), z.number()]).pipe(z.coerce.number());
          if (isRequired) {
            // Required: reject empty strings, null, undefined, and NaN
            fieldSchema = fieldSchema.refine(
              (val) => val !== undefined && val !== null && val !== "" && !isNaN(val),
              { message: "This field is required" }
            );
          }
          if (field.validation?.min !== undefined) {
            fieldSchema = fieldSchema.refine(
              (val) => val === undefined || val >= field.validation!.min!,
              { message: `Value must be at least ${field.validation.min}` }
            );
          }
          if (field.validation?.max !== undefined) {
            fieldSchema = fieldSchema.refine(
              (val) => val === undefined || val <= field.validation!.max!,
              { message: `Value must be at most ${field.validation.max}` }
            );
          }
          if (!isRequired) {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case "currency":
          // Currency stored as object with amount and currencyType
          fieldSchema = z.object({
            amount: z.union([z.string(), z.number()]).pipe(z.coerce.number()),
            currencyType: z.string(),
          });
          if (isRequired) {
            fieldSchema = (fieldSchema as any).refine(
              (val: any) => val && val.amount !== undefined && val.amount !== null && val.amount !== "" && !isNaN(val.amount),
              { message: "Amount is required" }
            );
          }
          if (field.validation?.min !== undefined) {
            fieldSchema = (fieldSchema as any).refine(
              (val: any) => val === undefined || val.amount === undefined || val.amount >= field.validation!.min!,
              { message: `Amount must be at least ${field.validation.min}` }
            );
          }
          if (field.validation?.max !== undefined) {
            fieldSchema = (fieldSchema as any).refine(
              (val: any) => val === undefined || val.amount === undefined || val.amount <= field.validation!.max!,
              { message: `Amount must be at most ${field.validation.max}` }
            );
          }
          if (!isRequired) {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case "decimal":
          // Decimal number with specific precision
          fieldSchema = z.union([z.string(), z.number()]).pipe(z.coerce.number());
          if (isRequired) {
            fieldSchema = fieldSchema.refine(
              (val) => val !== undefined && val !== null && val !== "" && !isNaN(val),
              { message: "This field is required" }
            );
          }
          // Validate decimal places if specified
          const decimalPlaces = (field.config as any)?.decimalPlaces;
          if (decimalPlaces !== undefined) {
            fieldSchema = fieldSchema.refine(
              (val) => {
                if (val === undefined || val === null || val === "") return true;
                const strVal = val.toString();
                const decimalIndex = strVal.indexOf('.');
                if (decimalIndex === -1) return true; // No decimals is fine
                const actualDecimals = strVal.length - decimalIndex - 1;
                return actualDecimals <= decimalPlaces;
              },
              { message: `Maximum ${decimalPlaces} decimal places allowed` }
            );
          }
          if (field.validation?.min !== undefined) {
            fieldSchema = fieldSchema.refine(
              (val) => val === undefined || val >= field.validation!.min!,
              { message: `Value must be at least ${field.validation.min}` }
            );
          }
          if (field.validation?.max !== undefined) {
            fieldSchema = fieldSchema.refine(
              (val) => val === undefined || val <= field.validation!.max!,
              { message: `Value must be at most ${field.validation.max}` }
            );
          }
          if (!isRequired) {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case "name":
          // Full name with title, first, middle (optional), last
          fieldSchema = z.object({
            title: z.string(),
            firstName: z.string(),
            middleName: z.string().optional(),
            lastName: z.string(),
          });
          if (isRequired) {
            fieldSchema = (fieldSchema as any).refine(
              (val: any) => val && val.firstName && val.firstName.trim().length > 0 && val.lastName && val.lastName.trim().length > 0,
              { message: "First name and last name are required" }
            );
          }
          if (!isRequired) {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case "email":
          fieldSchema = z.string();
          if (isRequired) {
            fieldSchema = (fieldSchema as z.ZodString).min(1, "Email is required");
          }
          fieldSchema = (fieldSchema as z.ZodString).email("Invalid email address");
          break;

        case "url":
          fieldSchema = z.string();
          if (isRequired) {
            fieldSchema = (fieldSchema as z.ZodString).min(1, "URL is required");
          }
          fieldSchema = (fieldSchema as z.ZodString).url("Invalid URL");
          break;

        case "phone":
          fieldSchema = z.string();
          if (isRequired) {
            fieldSchema = (fieldSchema as z.ZodString).min(1, "Phone number is required");
          }
          fieldSchema = (fieldSchema as z.ZodString).regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, "Invalid phone number");
          break;

        case "date":
        case "time":
        case "datetime":
          fieldSchema = z.date().or(z.string());
          if (isRequired) {
            fieldSchema = fieldSchema.refine((val) => val !== null && val !== undefined && val !== "", {
              message: "This field is required",
            });
          }
          break;

        case "checkbox":
          if (isRequired) {
            // Required checkbox must be true
            fieldSchema = z.literal(true, {
              errorMap: () => ({ message: "You must accept this" }),
            });
          } else {
            fieldSchema = z.boolean().optional();
          }
          break;

        case "multi_select":
          fieldSchema = z.array(z.string());
          if (isRequired) {
            fieldSchema = (fieldSchema as z.ZodArray<any>).min(1, "Please select at least one option");
          }
          break;

        case "address":
          fieldSchema = z.object({
            street: z.string(),
            city: z.string(),
            state: z.string(),
            zip: z.string(),
            country: z.string(),
          });
          if (isRequired) {
            // Required address must have at least street and city
            fieldSchema = (fieldSchema as any).refine(
              (val: any) => val && val.street && val.street.trim().length > 0 && val.city && val.city.trim().length > 0,
              { message: "Street address and city are required" }
            );
          }
          break;

        case "file_upload":
          fieldSchema = z.any(); // File handling
          if (isRequired) {
            fieldSchema = fieldSchema.refine((val) => val && (val.length > 0 || val instanceof FileList && val.length > 0), {
              message: "Please upload a file",
            });
          }
          break;

        case "audio":
        case "video":
        case "camera":
          // Media fields store base64 data URL or file path as string
          fieldSchema = z.string();
          if (isRequired) {
            fieldSchema = (fieldSchema as z.ZodString).min(1, "This field is required");
          } else {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case "image_choice":
          // Check if multiple selection is allowed
          const allowMultiple = (field.config as any)?.allowMultiple || false;
          if (allowMultiple) {
            fieldSchema = z.array(z.string());
            if (isRequired) {
              fieldSchema = (fieldSchema as z.ZodArray<any>).min(1, "Please select at least one option");
            }
          } else {
            fieldSchema = z.string();
            if (isRequired) {
              fieldSchema = (fieldSchema as z.ZodString).min(1, "Please select an option");
            } else {
              fieldSchema = fieldSchema.optional();
            }
          }
          break;

        case "matrix_choice":
          // Matrix stored as object with rowId keys and column values
          const matrixRows = (field.config as any)?.matrixRows || [];
          const matrixType = (field.config as any)?.matrixType || "radio";
          
          if (matrixType === "checkbox") {
            // For checkbox matrix, each row can have multiple selections (array)
            const rowSchemas: Record<string, z.ZodTypeAny> = {};
            matrixRows.forEach((row: any) => {
              const rowId = row.value || row.id;
              rowSchemas[rowId] = z.array(z.string());
              if (isRequired) {
                rowSchemas[rowId] = (rowSchemas[rowId] as z.ZodArray<any>).min(1, `Please select at least one option for ${row.label}`);
              }
            });
            fieldSchema = z.object(rowSchemas);
          } else {
            // For radio matrix, each row has single selection (string)
            const rowSchemas: Record<string, z.ZodTypeAny> = {};
            matrixRows.forEach((row: any) => {
              const rowId = row.value || row.id;
              if (isRequired) {
                rowSchemas[rowId] = z.string().min(1, `Please select an option for ${row.label}`);
              } else {
                rowSchemas[rowId] = z.string().optional();
              }
            });
            fieldSchema = z.object(rowSchemas);
          }
          
          if (!isRequired) {
            fieldSchema = fieldSchema.optional();
          }
          break;

        default:
          fieldSchema = z.string();
          if (isRequired) {
            fieldSchema = (fieldSchema as z.ZodString).min(1, field.validation?.errorMessage || "This field is required");
          }
          if (field.validation?.minLength) {
            fieldSchema = (fieldSchema as z.ZodString).min(field.validation.minLength);
          }
          if (field.validation?.maxLength) {
            fieldSchema = (fieldSchema as z.ZodString).max(field.validation.maxLength);
          }
          if (field.validation?.pattern) {
            fieldSchema = (fieldSchema as z.ZodString).regex(new RegExp(field.validation.pattern));
          }
          break;
      }

      // Apply optional for non-required fields (except checkbox which handles its own)
      if (!isRequired && field.type !== "checkbox") {
        fieldSchema = fieldSchema.optional();
      }

      schemaFields[field.id] = fieldSchema;
    });

    return z.object(schemaFields);
  };

  // Reactive schema that updates when conditional states change
  const schema = useMemo(() => buildSchema(conditionalStates), [conditionalStates, fields]);
  
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Watch form values and evaluate conditional rules
  const formValues = form.watch();
  
  useEffect(() => {
    if (conditionalRules.length > 0) {
      const newStates = evaluateConditionalRules(conditionalRules, formValues);
      // Only update if states actually changed to avoid infinite loops
      const hasChanged = 
        newStates.hidden.size !== conditionalStates.hidden.size ||
        newStates.required.size !== conditionalStates.required.size ||
        newStates.disabled.size !== conditionalStates.disabled.size ||
        Array.from(newStates.hidden).some(id => !conditionalStates.hidden.has(id)) ||
        Array.from(newStates.required).some(id => !conditionalStates.required.has(id)) ||
        Array.from(newStates.disabled).some(id => !conditionalStates.disabled.has(id));
      
      if (hasChanged) {
        setConditionalStates(newStates);
      }
    } else {
      // Reset all conditional states when no rules exist
      const hasStates = 
        conditionalStates.hidden.size > 0 ||
        conditionalStates.required.size > 0 ||
        conditionalStates.disabled.size > 0;
      
      if (hasStates) {
        setConditionalStates({
          hidden: new Set(),
          required: new Set(),
          disabled: new Set(),
        });
      }
    }
  }, [formValues, conditionalRules]);

  const handleSubmit = (data: Record<string, any>) => {
    onSubmit(data);
  };

  const renderField = (field: FormField) => {
    const { id, type, label, placeholder, description, helpText, validation, width = "full" } = field;

    // Skip hidden fields from conditional logic
    if (conditionalStates.hidden.has(id)) {
      return null;
    }

    // Skip non-input field types
    if (type === "heading" || type === "divider" || type === "html") {
      return renderStaticField(field);
    }

    // Check if field is required (field validation OR conditional logic)
    const isFieldRequired = validation?.required || conditionalStates.required.has(id);
    // Check if field is disabled by conditional logic
    const isFieldDisabled = conditionalStates.disabled.has(id);

    const widthClass = {
      full: "col-span-12",
      half: "col-span-12 md:col-span-6",
      third: "col-span-12 md:col-span-4",
      quarter: "col-span-12 md:col-span-3",
    }[width];

    return (
      <div key={id} className={widthClass} data-testid={`field-${id}`}>
        <div className="space-y-2">
          {label && (
            <Label htmlFor={id} className="flex items-center gap-1">
              {label}
              {isFieldRequired && <span className="text-destructive">*</span>}
            </Label>
          )}

          <Controller
            name={id}
            control={form.control}
            render={({ field: controllerField, fieldState }) => (
              <>
                {renderFieldInput(field, controllerField, fieldState, isFieldDisabled)}
                {fieldState.error && (
                  <p className="text-sm text-destructive" data-testid={`error-${id}`}>
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />

          {helpText && (
            <p className="text-sm text-muted-foreground">{helpText}</p>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    );
  };

  const renderFieldInput = (field: FormField, controllerField: any, fieldState: any, disabled: boolean = false) => {
    const { id, type, placeholder, options = [] } = field;

    switch (type) {
      case "text":
      case "email":
      case "phone":
      case "url":
        return (
          <Input
            {...controllerField}
            id={id}
            type={type === "text" ? "text" : type}
            placeholder={placeholder}
            disabled={disabled}
            data-testid={`input-${id}`}
          />
        );

      case "textarea":
        return (
          <Textarea
            {...controllerField}
            id={id}
            placeholder={placeholder}
            rows={4}
            disabled={disabled}
            data-testid={`textarea-${id}`}
          />
        );

      case "number":
      case "percentage":
        return (
          <Input
            {...controllerField}
            id={id}
            type="number"
            placeholder={placeholder}
            disabled={disabled}
            data-testid={`input-${id}`}
            onChange={(e) => {
              const val = e.target.value;
              controllerField.onChange(val === "" ? undefined : parseFloat(val));
            }}
          />
        );

      case "decimal":
        const decimalPlaces = (field.config as any)?.decimalPlaces || 2;
        const step = Math.pow(10, -decimalPlaces).toFixed(decimalPlaces);
        return (
          <Input
            {...controllerField}
            id={id}
            type="number"
            step={step}
            placeholder={placeholder}
            disabled={disabled}
            data-testid={`input-decimal-${id}`}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") {
                controllerField.onChange(undefined);
              } else {
                const numVal = parseFloat(val);
                // Round to specified decimal places
                const rounded = Math.round(numVal * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
                controllerField.onChange(rounded);
              }
            }}
          />
        );

      case "currency":
        const currencyValue = controllerField.value || { amount: "", currencyType: "USD" };
        const currencies = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "INR"];
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select
                value={currencyValue.currencyType || "USD"}
                onValueChange={(value) => controllerField.onChange({ ...currencyValue, currencyType: value })}
                disabled={disabled}
              >
                <SelectTrigger className="w-32" data-testid={`currency-type-${id}`}>
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={currencyValue.amount ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  controllerField.onChange({
                    ...currencyValue,
                    amount: val === "" ? undefined : parseFloat(val)
                  });
                }}
                type="number"
                step="0.01"
                placeholder="0.00"
                disabled={disabled}
                className="flex-1"
                data-testid={`currency-amount-${id}`}
              />
            </div>
          </div>
        );

      case "name":
        const nameValue = controllerField.value || { title: "", firstName: "", middleName: "", lastName: "" };
        const titles = ["Mr", "Mrs", "Ms", "Dr", "Prof"];
        return (
          <div className="space-y-2">
            <Select
              value={nameValue.title || ""}
              onValueChange={(value) => controllerField.onChange({ ...nameValue, title: value })}
              disabled={disabled}
            >
              <SelectTrigger data-testid={`name-title-${id}`}>
                <SelectValue placeholder="Title" />
              </SelectTrigger>
              <SelectContent>
                {titles.map((title) => (
                  <SelectItem key={title} value={title}>
                    {title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={nameValue.firstName || ""}
                onChange={(e) => controllerField.onChange({ ...nameValue, firstName: e.target.value })}
                placeholder="First Name"
                disabled={disabled}
                data-testid={`name-first-${id}`}
              />
              <Input
                value={nameValue.lastName || ""}
                onChange={(e) => controllerField.onChange({ ...nameValue, lastName: e.target.value })}
                placeholder="Last Name"
                disabled={disabled}
                data-testid={`name-last-${id}`}
              />
            </div>
            <Input
              value={nameValue.middleName || ""}
              onChange={(e) => controllerField.onChange({ ...nameValue, middleName: e.target.value })}
              placeholder="Middle Name (Optional)"
              disabled={disabled}
              data-testid={`name-middle-${id}`}
            />
          </div>
        );

      case "date":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={disabled}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !controllerField.value && "text-muted-foreground"
                )}
                data-testid={`button-date-${id}`}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {controllerField.value ? format(new Date(controllerField.value), "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={controllerField.value ? new Date(controllerField.value) : undefined}
                onSelect={(date) => controllerField.onChange(date)}
                disabled={disabled}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case "time":
        return (
          <Input
            {...controllerField}
            id={id}
            type="time"
            disabled={disabled}
            data-testid={`input-${id}`}
          />
        );

      case "datetime":
        return (
          <Input
            {...controllerField}
            id={id}
            type="datetime-local"
            disabled={disabled}
            data-testid={`input-${id}`}
          />
        );

      case "select":
        return (
          <Select value={controllerField.value} onValueChange={controllerField.onChange} disabled={disabled}>
            <SelectTrigger data-testid={`select-${id}`}>
              <SelectValue placeholder={placeholder || "Select an option"} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "radio":
        return (
          <RadioGroup value={controllerField.value} onValueChange={controllerField.onChange} disabled={disabled}>
            {options.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`${id}-${option.value}`} data-testid={`radio-${id}-${option.value}`} />
                <Label htmlFor={`${id}-${option.value}`}>{option.label}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={controllerField.value || false}
              onCheckedChange={controllerField.onChange}
              disabled={disabled}
              id={id}
              data-testid={`checkbox-${id}`}
            />
            <Label htmlFor={id} className="text-sm font-normal">
              {field.label}
            </Label>
          </div>
        );

      case "multi_select":
        return (
          <div className="space-y-2">
            {options.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  checked={(controllerField.value || []).includes(option.value)}
                  onCheckedChange={(checked) => {
                    const current = controllerField.value || [];
                    const updated = checked
                      ? [...current, option.value]
                      : current.filter((v: string) => v !== option.value);
                    controllerField.onChange(updated);
                  }}
                  disabled={disabled}
                  id={`${id}-${option.value}`}
                  data-testid={`checkbox-${id}-${option.value}`}
                />
                <Label htmlFor={`${id}-${option.value}`}>{option.label}</Label>
              </div>
            ))}
          </div>
        );

      case "slider":
        return (
          <div className="space-y-2">
            <Slider
              value={[controllerField.value || 0]}
              onValueChange={(values) => controllerField.onChange(values[0])}
              min={field.validation?.min || 0}
              max={field.validation?.max || 100}
              step={1}
              disabled={disabled}
              data-testid={`slider-${id}`}
            />
            <div className="text-sm text-muted-foreground text-center">
              {controllerField.value || 0}
            </div>
          </div>
        );

      case "rating":
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => !disabled && controllerField.onChange(rating)}
                disabled={disabled}
                className="p-1 hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid={`rating-${id}-${rating}`}
              >
                <Star
                  className={cn(
                    "h-6 w-6",
                    rating <= (controllerField.value || 0)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  )}
                />
              </button>
            ))}
          </div>
        );

      case "file_upload":
        return (
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
            <Input
              type="file"
              id={id}
              onChange={(e) => controllerField.onChange(e.target.files)}
              disabled={disabled}
              className="hidden"
              data-testid={`file-${id}`}
            />
            <Label htmlFor={id} className={cn("cursor-pointer", disabled && "opacity-50 cursor-not-allowed")}>
              <span className="text-sm text-muted-foreground">
                {disabled ? "File upload disabled" : "Click to upload or drag and drop"}
              </span>
            </Label>
          </div>
        );

      case "signature":
        return (
          <div className="border rounded-lg p-4 bg-background">
            <div className="aspect-[3/1] border-b-2 border-foreground/20 flex items-end justify-center pb-2">
              <Input
                {...controllerField}
                id={id}
                placeholder="Type your signature"
                disabled={disabled}
                className="border-0 text-2xl font-cursive text-center"
                data-testid={`signature-${id}`}
              />
            </div>
          </div>
        );

      case "address":
        const addressValue = controllerField.value || { street: "", city: "", state: "", zip: "", country: "" };
        return (
          <div className="space-y-2">
            <Input
              value={addressValue.street || ""}
              onChange={(e) => controllerField.onChange({ ...addressValue, street: e.target.value })}
              placeholder="Street Address"
              disabled={disabled}
              data-testid={`address-street-${id}`}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={addressValue.city || ""}
                onChange={(e) => controllerField.onChange({ ...addressValue, city: e.target.value })}
                placeholder="City"
                disabled={disabled}
                data-testid={`address-city-${id}`}
              />
              <Input
                value={addressValue.state || ""}
                onChange={(e) => controllerField.onChange({ ...addressValue, state: e.target.value })}
                placeholder="State/Province"
                disabled={disabled}
                data-testid={`address-state-${id}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={addressValue.zip || ""}
                onChange={(e) => controllerField.onChange({ ...addressValue, zip: e.target.value })}
                placeholder="ZIP/Postal Code"
                disabled={disabled}
                data-testid={`address-zip-${id}`}
              />
              <Input
                value={addressValue.country || ""}
                onChange={(e) => controllerField.onChange({ ...addressValue, country: e.target.value })}
                placeholder="Country"
                disabled={disabled}
                data-testid={`address-country-${id}`}
              />
            </div>
          </div>
        );

      case "image_choice":
        const allowMultiple = (field.config as any)?.allowMultiple || false;
        const imageSize = (field.config as any)?.imageSize || "medium";
        const imageSizeMap = {
          small: "100px",
          medium: "150px",
          large: "200px",
        };
        const imageHeight = imageSizeMap[imageSize as keyof typeof imageSizeMap] || imageSizeMap.medium;
        
        const currentValue = allowMultiple 
          ? (controllerField.value || [])
          : (controllerField.value || "");

        const isSelected = (optionValue: string) => {
          if (allowMultiple) {
            return (currentValue as string[]).includes(optionValue);
          }
          return currentValue === optionValue;
        };

        const handleImageChoice = (optionValue: string) => {
          if (disabled) return;
          
          if (allowMultiple) {
            const current = currentValue as string[];
            const updated = current.includes(optionValue)
              ? current.filter((v: string) => v !== optionValue)
              : [...current, optionValue];
            controllerField.onChange(updated);
          } else {
            controllerField.onChange(optionValue);
          }
        };

        return (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {options.map((option) => {
              const selected = isSelected(option.value);
              return (
                <Card
                  key={option.value}
                  className={cn(
                    "cursor-pointer hover-elevate transition-all relative overflow-hidden",
                    selected && "ring-2 ring-primary",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => handleImageChoice(option.value)}
                  data-testid={`image-option-${id}-${option.value}`}
                >
                  <CardContent className="p-0">
                    <div className="relative" style={{ height: imageHeight }}>
                      {option.imageUrl ? (
                        <img
                          src={option.imageUrl}
                          alt={option.label}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <span className="text-sm text-muted-foreground">{option.label}</span>
                        </div>
                      )}
                      {selected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="bg-primary rounded-full p-2">
                            <Check className="h-6 w-6 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-3 text-center">
                      <span className="text-sm font-medium">{option.label}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );

      case "matrix_choice":
        const matrixRows = (field.config as any)?.matrixRows || [];
        const matrixColumns = (field.config as any)?.matrixColumns || [];
        const matrixType = (field.config as any)?.matrixType || "radio";
        const matrixValue = controllerField.value || {};

        const handleMatrixChange = (rowValue: string, colValue: string, checked?: boolean) => {
          if (disabled) return;
          
          const current = { ...matrixValue };
          
          if (matrixType === "checkbox") {
            // Handle checkbox matrix - each row can have multiple selections
            const currentRowValues = current[rowValue] || [];
            if (checked) {
              current[rowValue] = [...currentRowValues, colValue];
            } else {
              current[rowValue] = currentRowValues.filter((v: string) => v !== colValue);
            }
          } else {
            // Handle radio matrix - each row has single selection
            current[rowValue] = colValue;
          }
          
          controllerField.onChange(current);
        };

        const isMatrixSelected = (rowValue: string, colValue: string) => {
          if (matrixType === "checkbox") {
            const rowValues = matrixValue[rowValue] || [];
            return rowValues.includes(colValue);
          }
          return matrixValue[rowValue] === colValue;
        };

        return (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border p-3 bg-muted text-left font-medium"></th>
                  {matrixColumns.map((col: any) => (
                    <th key={col.value} className="border p-3 bg-muted text-center font-medium">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row: any) => (
                  <tr key={row.value}>
                    <td className="border p-3 font-medium">{row.label}</td>
                    {matrixColumns.map((col: any) => (
                      <td
                        key={col.value}
                        className="border p-3 text-center"
                        data-testid={`matrix-cell-${id}-${row.value}-${col.value}`}
                      >
                        {matrixType === "checkbox" ? (
                          <div className="flex justify-center">
                            <Checkbox
                              checked={isMatrixSelected(row.value, col.value)}
                              onCheckedChange={(checked) => 
                                handleMatrixChange(row.value, col.value, checked as boolean)
                              }
                              disabled={disabled}
                            />
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <RadioGroupItem
                              value={col.value}
                              checked={isMatrixSelected(row.value, col.value)}
                              onClick={() => handleMatrixChange(row.value, col.value)}
                              disabled={disabled}
                            />
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "audio":
        return (
          <AudioField
            id={id}
            value={controllerField.value}
            onChange={controllerField.onChange}
            disabled={disabled}
          />
        );

      case "video":
        return (
          <VideoField
            id={id}
            value={controllerField.value}
            onChange={controllerField.onChange}
            disabled={disabled}
          />
        );

      case "camera":
        return (
          <CameraField
            id={id}
            value={controllerField.value}
            onChange={controllerField.onChange}
            disabled={disabled}
          />
        );

      default:
        return (
          <Input
            {...controllerField}
            id={id}
            placeholder={placeholder}
            disabled={disabled}
            data-testid={`input-${id}`}
          />
        );
    }
  };

  const renderStaticField = (field: FormField) => {
    const { id, type, label, description, width = "full" } = field;

    const widthClass = {
      full: "col-span-12",
      half: "col-span-12 md:col-span-6",
      third: "col-span-12 md:col-span-4",
      quarter: "col-span-12 md:col-span-3",
    }[width];

    switch (type) {
      case "heading":
        return (
          <div key={id} className={cn(widthClass, "pt-4")} data-testid={`heading-${id}`}>
            <h3 className="text-lg font-semibold">{label}</h3>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
        );

      case "divider":
        return (
          <div key={id} className={widthClass} data-testid={`divider-${id}`}>
            <hr className="my-4 border-t" />
          </div>
        );

      case "html":
        return (
          <div
            key={id}
            className={widthClass}
            dangerouslySetInnerHTML={{ __html: description || "" }}
            data-testid={`html-${id}`}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{formTemplate.name}</CardTitle>
        {formTemplate.description && (
          <CardDescription>{formTemplate.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-12 gap-4">
            {sortedFields.map((field) => renderField(field))}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="submit" disabled={isSubmitting} data-testid="button-submit-form">
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
