import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { Send, Image, Download, Paperclip, Trash2, ChevronDown, Palette, Edit, Plus, X } from 'lucide-react'
import { apiRequest, queryClient } from '@/lib/queryClient'

interface QuickCommand {
  id: string
  text: string
}

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  text?: string
  image?: string
  timestamp: Date
  prompt?: string // Store the prompt used to generate this image
}

interface ChatWindowProps {
  isOpen: boolean
  onClose: () => void
  onAttachCanvas: () => Promise<string> // Returns canvas image URL
  onSaveImage: (imageUrl: string) => Promise<void>
  onSaveToCanvas?: (imageUrl: string) => Promise<void> // Optional save to canvas
  onSaveToMediaLibrary?: (imageUrl: string, prompt: string) => Promise<void> // Optional save to Media Library
  canvasAspectRatio?: string // Optional canvas aspect ratio (e.g., "16:9", "1:1")
  imageGenerationEndpoint?: string // Optional custom endpoint for image generation
  hideModelSelector?: boolean // Hide model selector when forced model is used
}

const DEFAULT_COMMANDS: QuickCommand[] = [
  { id: '1', text: 'Make a transparent png' },
  { id: '2', text: 'Flip image horizontal' },
  { id: '3', text: 'Flip image vertically' }
]

export function ChatWindow({ isOpen, onClose, onAttachCanvas, onSaveImage, onSaveToCanvas, onSaveToMediaLibrary, canvasAspectRatio, imageGenerationEndpoint = '/api/chat/start-image-generation', hideModelSelector = false }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [attachedCanvas, setAttachedCanvas] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('4o-images')
  const [generationProgress, setGenerationProgress] = useState(0)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [lockedModel, setLockedModel] = useState<string | null>(null)
  const [currentPrompt, setCurrentPrompt] = useState<string>('') // Store the current generation prompt
  const [editingImageId, setEditingImageId] = useState<string | null>(null) // Track which image is being edited
  const [editPrompt, setEditPrompt] = useState<string>('') // Store the edit instruction
  const [quickCommands, setQuickCommands] = useState<QuickCommand[]>(DEFAULT_COMMANDS)
  const [newCommandText, setNewCommandText] = useState('')
  const [isAddingCommand, setIsAddingCommand] = useState(false)
  const pollingRef = useRef<boolean>(false)
  const { toast } = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Cleanup polling when dialog closes
  useEffect(() => {
    if (!isOpen && pollingRef.current) {
      pollingRef.current = false
      setIsGenerating(false)
      setGenerationProgress(0)
      setCurrentTaskId(null)
      setLockedModel(null)
    }
  }, [isOpen])

  // Auto-scroll during generation to keep progress visible
  useEffect(() => {
    if (isGenerating || generationProgress > 0) {
      scrollToBottom()
    }
  }, [isGenerating, generationProgress])

  // Auto-attach canvas when dialog opens
  useEffect(() => {
    if (isOpen && !attachedCanvas) {
      handleAttachCanvas()
    }
  }, [isOpen])

  // Load quick commands from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('quickCommands')
    if (saved) {
      try {
        setQuickCommands(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse saved commands:', e)
      }
    }
  }, [])

  // Save quick commands to localStorage
  useEffect(() => {
    localStorage.setItem('quickCommands', JSON.stringify(quickCommands))
  }, [quickCommands])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleUseCommand = (commandText: string) => {
    setInputText(commandText)
  }

  const handleAddCommand = () => {
    if (!newCommandText.trim()) return
    
    const newCommand: QuickCommand = {
      id: Date.now().toString(),
      text: newCommandText.trim()
    }
    setQuickCommands([...quickCommands, newCommand])
    setNewCommandText('')
    setIsAddingCommand(false)
    toast({
      title: "Command Added",
      description: "Quick command has been saved",
    })
  }

  const handleDeleteCommand = (id: string) => {
    setQuickCommands(quickCommands.filter(cmd => cmd.id !== id))
    toast({
      title: "Command Deleted",
      description: "Quick command has been removed",
    })
  }

  const handleAttachCanvas = async () => {
    try {
      const canvasImageUrl = await onAttachCanvas()
      setAttachedCanvas(canvasImageUrl)
      toast({
        title: "Canvas Attached",
        description: "Your canvas has been attached to the chat",
      })
    } catch (error) {
      console.error('Failed to attach canvas:', error)
      toast({
        title: "Attachment Failed",
        description: "Could not attach canvas to chat",
        variant: "destructive",
      })
    }
  }

  const pollGenerationStatus = async (taskId: string, model: string, retryCount: number = 0, startTime: number = Date.now(), timeoutRetryCount: number = 0) => {
    try {
      // Check if generation has been running too long (6 minutes timeout)
      const elapsed = Date.now() - startTime
      const timeoutMs = 6 * 60 * 1000 // 6 minutes
      
      if (elapsed > timeoutMs) {
        console.error(`Generation timeout: Job has been running for ${Math.round(elapsed / 1000)}s`)
        
        // Allow up to 2 automatic retries on timeout (total of 3 attempts)
        if (timeoutRetryCount < 2) {
          console.log(`Timeout retry ${timeoutRetryCount + 1}: Extending wait time for taskId=${taskId}`)
          
          toast({
            title: "Generation Taking Longer Than Expected",
            description: `Still waiting... (Extended timeout ${timeoutRetryCount + 1} of 2)`,
          })
          
          // Continue polling with extended timeout - reset the start time
          setTimeout(() => {
            pollGenerationStatus(taskId, model, 0, Date.now(), timeoutRetryCount + 1)
          }, 2000)
          return
        }
        
        // All retries exhausted
        pollingRef.current = false
        setIsGenerating(false)
        setGenerationProgress(0)
        setCurrentTaskId(null)
        
        toast({
          title: "Generation Timeout",
          description: "Image generation took too long after multiple timeout extensions. Please try again with a simpler prompt.",
          variant: "destructive",
        })
        return
      }
      
      const response = await fetch(`/api/chat/image-generation-status/${taskId}?model=${model}`)
      
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`)
      }
      
      const status = await response.json()
      
      // Update progress - server already returns 0-100 number
      const progressValue = status.progress || 0
      console.log('Progress update:', { rawProgress: status.progress, finalProgress: progressValue })
      setGenerationProgress(progressValue)
      
      if (status.status === 'completed' && status.imageUrl) {
        // Generation completed successfully
        console.log('Generation completed, creating assistant message')
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          image: status.imageUrl,
          timestamp: new Date(),
          prompt: currentPrompt // Store the prompt for later use
        }

        setMessages(prev => [...prev, assistantMessage])
        setAttachedCanvas(null) // Clear attached canvas after use
        
        // Stop polling first
        pollingRef.current = false
        
        // Reset generation state
        setIsGenerating(false)
        setGenerationProgress(100) // Show 100% before clearing
        setCurrentTaskId(null)
        
        toast({
          title: "Image Generated",
          description: "New image has been created successfully",
        })
        
        // Clear progress after a short delay to show completion
        setTimeout(() => {
          setGenerationProgress(0)
        }, 1000)
        
        setTimeout(scrollToBottom, 100)
      } else if (status.status === 'failed') {
        // Generation failed
        setIsGenerating(false)
        setGenerationProgress(0)
        setCurrentTaskId(null)
        
        toast({
          title: "Generation Failed",
          description: status.error || "Could not generate image. Please try again.",
          variant: "destructive",
        })
      } else {
        // Still generating - continue polling if still active
        if (pollingRef.current) {
          setTimeout(() => pollGenerationStatus(taskId, model, 0, startTime, timeoutRetryCount), 2000)
        }
      }
    } catch (error) {
      console.error('Failed to check generation status:', error)
      
      // Retry on transient errors with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
        setTimeout(() => pollGenerationStatus(taskId, model, retryCount + 1, startTime, timeoutRetryCount), delay)
        return
      }
      
      // Max retries exceeded - fail the generation
      setIsGenerating(false)
      setGenerationProgress(0)
      setCurrentTaskId(null)
      
      toast({
        title: "Status Check Failed",
        description: "Could not check generation progress. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSendMessage = async () => {
    if (!inputText.trim() && !attachedCanvas) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: inputText.trim(),
      image: attachedCanvas || undefined,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const promptText = inputText.trim() // Capture prompt before clearing
    setCurrentPrompt(promptText) // Store for later use in assistant message
    setInputText('')
    setIsGenerating(true)
    setGenerationProgress(0)
    
    // Auto-scroll to show the progress bar
    setTimeout(scrollToBottom, 100)

    try {
      // Start image generation with new progress tracking API
      const response = await fetch(imageGenerationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          baseImage: attachedCanvas,
          model: selectedModel,
          canvasAspectRatio: canvasAspectRatio // Send canvas aspect ratio to preserve dimensions
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 402) {
          throw new Error(errorData.message || "AI service has insufficient credits")
        }
        throw new Error(`Image generation failed: ${response.status}`)
      }

      const result = await response.json() as { taskId: string, model: string, status: string }
      
      // Store task ID, lock model, and start polling for progress
      setCurrentTaskId(result.taskId)
      setLockedModel(result.model)
      pollingRef.current = true
      
      // Start polling for status updates
      setTimeout(() => pollGenerationStatus(result.taskId, result.model, 0, Date.now(), 0), 2000)

    } catch (error) {
      console.error('Failed to start image generation:', error)
      setIsGenerating(false)
      setGenerationProgress(0)
      setCurrentTaskId(null)
      
      const errorMessage = error instanceof Error ? error.message : "Could not start image generation. Please try again."
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleSaveImage = async (imageUrl: string, destination: 'canvas' | 'media-library', messagePrompt?: string) => {
    try {
      if (destination === 'canvas' && onSaveToCanvas) {
        await onSaveToCanvas(imageUrl)
        toast({
          title: "Image Saved to Canvas",
          description: "Generated image saved to canvas editor",
        })
      } else if (destination === 'media-library' && onSaveToMediaLibrary) {
        const prompt = messagePrompt || currentPrompt || 'AI Generated Image'
        await onSaveToMediaLibrary(imageUrl, prompt)
        toast({
          title: "Image Saved to Media Library",
          description: "Generated image saved to Media Library",
        })
      }
    } catch (error) {
      console.error('Failed to save image:', error)
      const errorMsg = destination === 'media-library' ? 'Media Library' : 'Canvas'
      toast({
        title: "Save Failed",
        description: `Could not save image to ${errorMsg}`,
        variant: "destructive",
      })
    }
  }

  const handleEditImage = async (messageId: string, baseImageUrl: string) => {
    if (!editPrompt.trim()) {
      toast({
        title: "Edit Instructions Required",
        description: "Please describe what changes you want to make",
        variant: "destructive",
      })
      return
    }

    // Add user message with edit instruction
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: `Edit: ${editPrompt.trim()}`,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const editPromptText = editPrompt.trim()
    setCurrentPrompt(editPromptText)
    setEditPrompt('')
    setEditingImageId(null)
    setIsGenerating(true)
    setGenerationProgress(0)
    
    setTimeout(scrollToBottom, 100)

    try {
      // Convert image URL to base64 data first
      const convertResponse = await fetch('/api/convert-image-to-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: baseImageUrl })
      })

      if (!convertResponse.ok) {
        throw new Error('Failed to convert image to base64')
      }

      const { dataUrl } = await convertResponse.json()

      // Start image edit with base64 image data
      const response = await fetch(imageGenerationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: editPromptText,
          baseImage: dataUrl,
          model: selectedModel,
          canvasAspectRatio: canvasAspectRatio
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 402) {
          throw new Error(errorData.message || "AI service has insufficient credits")
        }
        throw new Error(`Image edit failed: ${response.status}`)
      }

      const result = await response.json() as { taskId: string, model: string, status: string }
      
      setCurrentTaskId(result.taskId)
      setLockedModel(result.model)
      pollingRef.current = true
      
      setTimeout(() => pollGenerationStatus(result.taskId, result.model, 0, Date.now(), 0), 2000)

    } catch (error) {
      console.error('Failed to edit image:', error)
      setIsGenerating(false)
      setGenerationProgress(0)
      setCurrentTaskId(null)
      
      const errorMessage = error instanceof Error ? error.message : "Could not edit image. Please try again."
      toast({
        title: "Edit Failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleClearChat = () => {
    setMessages([])
    setAttachedCanvas(null)
    setEditingImageId(null)
    setEditPrompt('')
    toast({
      title: "Chat Cleared",
      description: "All messages have been cleared",
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              AI Image Generator
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearChat}
              disabled={messages.length === 0}
              data-testid="button-clear-chat"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear Chat
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex gap-2 overflow-hidden">
          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 p-1">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <Image className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Start a conversation to generate images</p>
                  <p className="text-sm">Attach your canvas and describe what you'd like to create</p>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <Card className={`max-w-md ${message.type === 'user' ? 'bg-primary text-primary-foreground' : ''}`}>
                    <div className="p-3">
                      {message.text && (
                        <p className="text-sm mb-2">{message.text}</p>
                      )}
                      {message.image && (
                        <div className="space-y-2">
                          {message.type === 'user' ? (
                            <div className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1">
                              <Paperclip className="w-3 h-3" />
                              <span>Canvas attached</span>
                            </div>
                          ) : (
                            <img
                              src={message.image}
                              alt="Generated content"
                              className="w-full rounded border"
                              data-testid={`chat-image-${message.id}`}
                            />
                          )}
                          {message.type === 'assistant' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full"
                                  data-testid={`button-save-image-${message.id}`}
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  Save Image
                                  <ChevronDown className="w-3 h-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="center" className="w-56">
                                {onSaveToMediaLibrary && (
                                  <DropdownMenuItem 
                                    onClick={() => handleSaveImage(message.image!, 'media-library', message.prompt)}
                                    data-testid={`save-to-media-library-${message.id}`}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Save to Media Library
                                  </DropdownMenuItem>
                                )}
                                {onSaveToCanvas && (
                                  <DropdownMenuItem 
                                    onClick={() => handleSaveImage(message.image!, 'canvas')}
                                    data-testid={`save-to-canvas-${message.id}`}
                                  >
                                    <Palette className="w-4 h-4 mr-2" />
                                    Save to Canvas
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setEditingImageId(message.id)
                                    setEditPrompt('')
                                  }}
                                  data-testid={`edit-image-${message.id}`}
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit Image
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          {/* Edit Image UI */}
                          {message.type === 'assistant' && editingImageId === message.id && (
                            <div className="space-y-2 p-3 bg-muted rounded-lg border">
                              <Label className="text-xs font-medium">Describe your changes</Label>
                              <Input
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter' && editPrompt.trim()) {
                                    handleEditImage(message.id, message.image!)
                                  }
                                }}
                                placeholder="e.g., make it brighter, add a sunset, change color to blue..."
                                disabled={isGenerating}
                                data-testid={`input-edit-prompt-${message.id}`}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleEditImage(message.id, message.image!)}
                                  disabled={isGenerating || !editPrompt.trim()}
                                  data-testid={`button-apply-edit-${message.id}`}
                                >
                                  <Send className="w-3 h-3 mr-1" />
                                  Apply Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingImageId(null)
                                    setEditPrompt('')
                                  }}
                                  disabled={isGenerating}
                                  data-testid={`button-cancel-edit-${message.id}`}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              ))}
              <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </div>

          <Separator className="my-4" />

          {/* Canvas Attachment Preview - Compact */}
          {attachedCanvas && (
            <div className="mb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded px-3 py-2">
                <img
                  src={attachedCanvas}
                  alt="Attached canvas"
                  className="w-8 h-8 object-cover rounded border"
                />
                <span className="flex-1">Canvas ready for generation</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAttachedCanvas(null)}
                  className="h-6 px-2 text-xs"
                >
                  Remove
                </Button>
              </div>
            </div>
          )}

          {/* Model Selection - Hidden for Canvas (forced GPT-4o) */}
          {!hideModelSelector && (
            <div className="mb-4">
              <Label htmlFor="model-select" className="text-sm font-medium mb-2 block">
                AI Model
              </Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger data-testid="select-ai-model">
                  <SelectValue placeholder="Choose AI model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nano-banana">Nano Banana (Fast & Efficient)</SelectItem>
                  <SelectItem value="4o-images">4o Images (GPT-4o Vision)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Input Area */}
          <div className="flex gap-2 items-end">
            <Button
              size="icon"
              variant="outline"
              onClick={handleAttachCanvas}
              data-testid="button-attach-canvas"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe the image you want to generate... (Press Enter to send, Shift+Enter for new line)"
              disabled={isGenerating}
              className="min-h-[80px] max-h-[200px] resize-none"
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isGenerating || (!inputText.trim() && !attachedCanvas)}
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {/* Fixed Progress Bar at Bottom */}
          {isGenerating && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-sm font-medium">
                    Generating image with {(lockedModel || selectedModel) === 'nano-banana' ? 'Nano Banana' : '4o Images'}...
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{generationProgress}%</span>
                  </div>
                  <Progress 
                    value={generationProgress} 
                    className="h-3" 
                    data-testid="progress-image-generation"
                  />
                  {(lockedModel || selectedModel) === '4o-images' && generationProgress < 50 && (
                    <p className="text-xs text-muted-foreground">
                      4o Images takes 2-3 minutes to generate high-quality results
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>

          {/* Quick Commands Panel */}
          <div className="w-56 flex-shrink-0 border-l pl-3">
            <div className="flex flex-col h-full">
              <h3 className="text-sm font-semibold mb-3">Quick Commands</h3>
              
              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-1">
                  {quickCommands.map((command) => (
                    <div key={command.id} className="group relative">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full justify-start text-left h-auto py-2 pr-8"
                        onClick={() => handleUseCommand(command.text)}
                        data-testid={`quick-command-${command.id}`}
                      >
                        <span className="text-xs line-clamp-2">{command.text}</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteCommand(command.id)}
                        data-testid={`delete-command-${command.id}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Separator className="my-3" />

              {/* Add Command Section */}
              {isAddingCommand ? (
                <div className="space-y-2">
                  <Input
                    value={newCommandText}
                    onChange={(e) => setNewCommandText(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddCommand()
                      }
                    }}
                    placeholder="Enter command..."
                    className="text-xs"
                    data-testid="input-new-command"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleAddCommand}
                      disabled={!newCommandText.trim()}
                      className="flex-1"
                      data-testid="button-save-command"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsAddingCommand(false)
                        setNewCommandText('')
                      }}
                      data-testid="button-cancel-command"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsAddingCommand(true)}
                  className="w-full"
                  data-testid="button-add-command"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Command
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}