import { useState, useRef, useEffect } from 'react'
import { Canvas as FabricCanvas, Image as FabricImage, IText, Rect as FabricRect } from 'fabric'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useProjectContext } from '@/contexts/ProjectContext'
import { ChatWindow } from '@/components/ChatWindow'
import { PrintfulBrowser } from '@/components/PrintfulBrowser'
import { useQuery } from '@tanstack/react-query'
import { apiRequest, queryClient } from '@/lib/queryClient'
import type { Project, ProductListing } from '@shared/schema'
import { 
  Plus, 
  Upload, 
  Type, 
  Layers, 
  Move, 
  RotateCcw, 
  Trash2, 
  Eye, 
  EyeOff,
  Square,
  Download,
  Copy,
  Save,
  MessageCircle,
  Package,
  Image as ImageIcon,
  X
} from 'lucide-react'

type CanvasSize = {
  name: string
  width: number
  height: number
  ratio: string
}

type CanvasLayer = {
  id: string
  name: string
  type: 'image' | 'text' | 'shape'
  visible: boolean
  fabricObject: any
}

const CANVAS_SIZES: CanvasSize[] = [
  { name: 'Square', width: 800, height: 800, ratio: '1:1' },
  { name: 'Landscape', width: 800, height: 533, ratio: '3:2' },
  { name: 'Portrait', width: 533, height: 800, ratio: '2:3' },
  { name: 'Wide', width: 800, height: 450, ratio: '16:9' },
  { name: 'Social Media Post', width: 800, height: 800, ratio: '1:1' },
  { name: 'Instagram Story', width: 450, height: 800, ratio: '9:16' }
]

const FONT_FAMILIES = [
  'Arial',
  'Arial Black',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Impact',
  'Comic Sans MS',
  'Trebuchet MS',
  'Palatino',
  'Garamond',
  'Bookman',
  'Avant Garde',
  'Century Gothic',
  'Calibri',
  'Candara',
  'Franklin Gothic',
  'Futura',
  'Optima'
]

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<FabricCanvas | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [selectedSize, setSelectedSize] = useState<CanvasSize>(CANVAS_SIZES[2])
  const [layers, setLayers] = useState<CanvasLayer[]>([])
  const [selectedLayer, setSelectedLayer] = useState<CanvasLayer | null>(null)
  const [textInput, setTextInput] = useState('')
  const [layerIdCounter, setLayerIdCounter] = useState(1)
  const layersRef = useRef<CanvasLayer[]>([])
  const layerIdCounterRef = useRef(1)
  
  // Text styling state
  const [textFontFamily, setTextFontFamily] = useState('Arial')
  const [textFontSize, setTextFontSize] = useState(32)
  const [textColor, setTextColor] = useState('#000000')
  const [textRotation, setTextRotation] = useState(0)

  // Shape styling state
  const [shapeWidth, setShapeWidth] = useState(200)
  const [shapeHeight, setShapeHeight] = useState(150)
  const [shapeFillColor, setShapeFillColor] = useState('#8B5CF6')

  // Keep layersRef and layerIdCounterRef in sync with state
  useEffect(() => {
    layersRef.current = layers
  }, [layers])
  
  useEffect(() => {
    layerIdCounterRef.current = layerIdCounter
  }, [layerIdCounter])
  
  const { toast } = useToast()
  const { selectedProject, selectedProduct, setSelectedProject, setSelectedProduct } = useProjectContext()
  const [isSavingToProduct, setIsSavingToProduct] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isPrintfulBrowserOpen, setIsPrintfulBrowserOpen] = useState(false)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const libraryFileInputRef = useRef<HTMLInputElement>(null)
  const bulkFileInputRef = useRef<HTMLInputElement>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null)
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null)
  const isReorderingRef = useRef(false)
  const [isDraggingToLibrary, setIsDraggingToLibrary] = useState(false)

  // Fetch projects for selection
  const { data: projectsData } = useQuery({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects')
      if (!response.ok) {
        // Return empty array on error (e.g., unauthenticated)
        return []
      }
      return response.json() as Promise<Project[]>
    }
  })
  
  // Ensure projects is always an array
  const projects = Array.isArray(projectsData) ? projectsData : []

  // Fetch products for the selected project
  const { data: products = [] } = useQuery({
    queryKey: ['/api/projects', selectedProject?.id, 'products'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${selectedProject?.id}/product-listings`)
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`)
      }
      return response.json() as Promise<ProductListing[]>
    },
    enabled: !!selectedProject?.id
  })

  // Fetch library assets
  const { data: libraryAssets = [], refetch: refetchLibraryAssets } = useQuery({
    queryKey: ['/api/branding-assets'],
    queryFn: async () => {
      const response = await fetch('/api/branding-assets')
      if (!response.ok) {
        throw new Error('Failed to fetch library assets')
      }
      return response.json()
    }
  })

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = new FabricCanvas(canvasRef.current, {
        width: selectedSize.width,
        height: selectedSize.height,
        backgroundColor: '#ffffff',
        selection: true,
        interactive: true,
        preserveObjectStacking: true  // Prevent objects from moving to front on selection
      })

      fabricCanvasRef.current = canvas

      // Handle object selection
      const handleSelectionCreated = (e: any) => {
        if (e.target) {
          const layer = layersRef.current.find(l => l.fabricObject === e.target)
          if (layer) {
            setSelectedLayer(layer)
          }
        }
      }

      const handleSelectionUpdated = (e: any) => {
        if (e.target) {
          const layer = layersRef.current.find(l => l.fabricObject === e.target)
          if (layer) {
            setSelectedLayer(layer)
          }
        }
      }

      const handleSelectionCleared = () => {
        setSelectedLayer(null)
      }

      canvas.on('selection:created', handleSelectionCreated)
      canvas.on('selection:updated', handleSelectionUpdated)
      canvas.on('selection:cleared', handleSelectionCleared)

      // Handle object modifications
      canvas.on('object:modified', (e: any) => {
        canvas.renderAll()
        
        // Update shape properties when manually resized on canvas
        if (e.target) {
          const layer = layersRef.current.find(l => l.fabricObject === e.target)
          if (layer?.type === 'shape') {
            const scaledWidth = Math.round((e.target.width || 200) * (e.target.scaleX || 1))
            const scaledHeight = Math.round((e.target.height || 150) * (e.target.scaleY || 1))
            setShapeWidth(scaledWidth)
            setShapeHeight(scaledHeight)
          }
        }
      })

      // Track dragging from canvas to library
      let isDraggingFromCanvas = false
      let draggedCanvasObject: any = null

      canvas.on('mouse:down', (e: any) => {
        if (e.target) {
          isDraggingFromCanvas = true
          draggedCanvasObject = e.target
        }
      })

      canvas.on('mouse:move', (e: any) => {
        if (isDraggingFromCanvas && draggedCanvasObject && e.e) {
          const mouseX = e.e.clientX
          const mouseY = e.e.clientY
          
          const libraryPanel = document.querySelector('[data-testid="library-panel"]')
          if (libraryPanel) {
            const rect = libraryPanel.getBoundingClientRect()
            const isOverLibrary = mouseX >= rect.left && mouseX <= rect.right && 
                                  mouseY >= rect.top && mouseY <= rect.bottom
            
            setIsDraggingToLibrary(isOverLibrary)
            
            if (isOverLibrary) {
              document.title = '🟢 DRAG OVER LIBRARY (CANVAS)'
            } else {
              document.title = '🔵 DRAGGING FROM CANVAS'
            }
          }
        }
      })

      canvas.on('mouse:up', (e: any) => {
        if (isDraggingFromCanvas && draggedCanvasObject && e.e) {
          // Get mouse position
          const mouseX = e.e.clientX
          const mouseY = e.e.clientY
          
          // Check if library panel is open and get its position
          const libraryPanel = document.querySelector('[data-testid="library-panel"]')
          if (libraryPanel) {
            const rect = libraryPanel.getBoundingClientRect()
            
            // Check if mouse is over library panel
            if (mouseX >= rect.left && mouseX <= rect.right && 
                mouseY >= rect.top && mouseY <= rect.bottom) {
              // Find the layer for this object
              const layer = layersRef.current.find(l => l.fabricObject === draggedCanvasObject)
              if (layer) {
                // Export to library
                handleExportLayerToLibrary(layer)
              }
            }
          }
        }
        
        setIsDraggingToLibrary(false)
        document.title = 'MyPODAgent - Canvas'
        isDraggingFromCanvas = false
        draggedCanvasObject = null
      })

      // Restore saved canvas state from localStorage
      try {
        const savedState = localStorage.getItem('canvasState')
        if (savedState) {
          const { canvasJSON, layersData, layerIdCount } = JSON.parse(savedState)
          
          // Restore canvas objects from JSON
          canvas.loadFromJSON(canvasJSON).then(() => {
            // Rebuild layers array with restored objects
            const objects = canvas.getObjects()
            const restoredLayers = layersData.map((layerData: any, index: number) => ({
              ...layerData,
              fabricObject: objects[index]
            }))
            
            setLayers(restoredLayers)
            setLayerIdCounter(layerIdCount)
            canvas.renderAll()
          }).catch((error: any) => {
            console.error('Failed to restore canvas state:', error)
          })
        }
      } catch (error) {
        console.error('Failed to parse saved canvas state:', error)
      }

      return () => {
        // Save canvas state before unmounting
        if (fabricCanvasRef.current) {
          try {
            const canvasJSON = fabricCanvasRef.current.toJSON()
            const layersData = layersRef.current.map(layer => ({
              id: layer.id,
              name: layer.name,
              type: layer.type,
              visible: layer.visible
            }))
            
            localStorage.setItem('canvasState', JSON.stringify({
              canvasJSON,
              layersData,
              layerIdCount: layerIdCounterRef.current
            }))
          } catch (error) {
            console.error('Failed to save canvas state:', error)
          }
        }
        
        canvas.off('selection:created', handleSelectionCreated)
        canvas.off('selection:updated', handleSelectionUpdated)
        canvas.off('selection:cleared', handleSelectionCleared)
        canvas.off('object:modified')
        canvas.dispose()
      }
    }
  }, [])

  // Update canvas size when selectedSize changes
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.setWidth(selectedSize.width)
      fabricCanvasRef.current.setHeight(selectedSize.height)
      fabricCanvasRef.current.renderAll()
    }
  }, [selectedSize])

  // Update layers when canvas objects change
  useEffect(() => {
    if (fabricCanvasRef.current) {
      const updateLayers = () => {
        // Skip sync during reordering to prevent clearing layers
        if (isReorderingRef.current) return
        
        const objects = fabricCanvasRef.current?.getObjects() || []
        setLayers(prev => 
          prev.filter(layer => objects.includes(layer.fabricObject))
        )
      }

      fabricCanvasRef.current.on('object:added', updateLayers)
      fabricCanvasRef.current.on('object:removed', updateLayers)

      return () => {
        fabricCanvasRef.current?.off('object:added', updateLayers)
        fabricCanvasRef.current?.off('object:removed', updateLayers)
      }
    }
  }, [])

  // Handle keyboard delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayer) {
        // Only delete if not typing in an input/textarea
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        e.preventDefault()
        handleDeleteLayer(selectedLayer)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedLayer])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !fabricCanvasRef.current) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string
      
      FabricImage.fromURL(imageUrl)
        .then((img: any) => {
          // Scale image to fit canvas while maintaining aspect ratio
          const canvas = fabricCanvasRef.current!
          const maxWidth = canvas.getWidth() * 0.8
          const maxHeight = canvas.getHeight() * 0.8
          
          const scaleX = maxWidth / (img.width || 1)
          const scaleY = maxHeight / (img.height || 1)
          const scale = Math.min(scaleX, scaleY)
          
          img.set({
            scaleX: scale,
            scaleY: scale,
            left: (canvas.getWidth() - (img.width || 0) * scale) / 2,
            top: (canvas.getHeight() - (img.height || 0) * scale) / 2
          })

          canvas.add(img)
          canvas.setActiveObject(img)
          canvas.renderAll()

          // Add to layers
          const newLayer: CanvasLayer = {
            id: `layer-${layerIdCounter}`,
            name: `Image ${layerIdCounter}`,
            type: 'image',
            visible: true,
            fabricObject: img
          }
          
          setLayers(prev => [...prev, newLayer])
          setSelectedLayer(newLayer)
          setLayerIdCounter(prev => prev + 1)
          
          toast({
            title: "Image Added",
            description: "Image has been added to the canvas",
          })
        })
        .catch((error: any) => {
          console.error('Failed to load image:', error)
          toast({
            title: "Error",
            description: "Failed to load image",
            variant: "destructive"
          })
        })
    }
    reader.readAsDataURL(file)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handlePrintfulImport = async (productImage: string, productData: any) => {
    if (!fabricCanvasRef.current) return

    try {
      // Use proxy endpoint to fetch image and avoid CORS issues
      const proxyUrl = `/api/printful/proxy-image?url=${encodeURIComponent(productImage)}`
      const response = await fetch(proxyUrl)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`)
      }
      
      const blob = await response.blob()
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        
        FabricImage.fromURL(dataUrl)
          .then((img: any) => {
            const canvas = fabricCanvasRef.current!
            const maxWidth = canvas.getWidth() * 0.8
            const maxHeight = canvas.getHeight() * 0.8
            
            const scaleX = maxWidth / (img.width || 1)
            const scaleY = maxHeight / (img.height || 1)
            const scale = Math.min(scaleX, scaleY)
            
            img.set({
              scaleX: scale,
              scaleY: scale,
              left: (canvas.getWidth() - (img.width || 0) * scale) / 2,
              top: (canvas.getHeight() - (img.height || 0) * scale) / 2,
              data: { printfulData: productData }
            })

            canvas.add(img)
            canvas.setActiveObject(img)
            canvas.renderAll()

            const newLayer: CanvasLayer = {
              id: `layer-${layerIdCounter}`,
              name: `Printful: ${productData.variantName}`,
              type: 'image',
              visible: true,
              fabricObject: img
            }
            
            setLayers(prev => [...prev, newLayer])
            setSelectedLayer(newLayer)
            setLayerIdCounter(prev => prev + 1)
          })
          .catch((error: any) => {
            console.error('Failed to create fabric image:', error)
            toast({
              title: "Error",
              description: "Failed to load Printful product",
              variant: "destructive"
            })
          })
      }
      
      reader.onerror = () => {
        toast({
          title: "Error",
          description: "Failed to read image data",
          variant: "destructive"
        })
      }
      
      reader.readAsDataURL(blob)
    } catch (error) {
      console.error('Failed to fetch Printful product image:', error)
      toast({
        title: "Error",
        description: "Failed to load Printful product",
        variant: "destructive"
      })
    }
  }

  const handleAddText = () => {
    if (!textInput.trim() || !fabricCanvasRef.current) return

    const text = new IText(textInput, {
      left: 50,
      top: 50,
      fontSize: textFontSize,
      fill: textColor,
      fontFamily: textFontFamily,
      angle: textRotation
    })

    fabricCanvasRef.current.add(text)
    fabricCanvasRef.current.setActiveObject(text)
    fabricCanvasRef.current.renderAll()

    // Add to layers
    const newLayer: CanvasLayer = {
      id: `layer-${layerIdCounter}`,
      name: `Text ${layerIdCounter}`,
      type: 'text',
      visible: true,
      fabricObject: text
    }
    
    setLayers(prev => [...prev, newLayer])
    setSelectedLayer(newLayer)
    setLayerIdCounter(prev => prev + 1)
    setTextInput('')
    
    toast({
      title: "Text Added",
      description: "Text layer has been added to the canvas",
    })
  }

  const handleAddRectangle = () => {
    if (!fabricCanvasRef.current) return

    const rect = new FabricRect({
      left: 100,
      top: 100,
      width: shapeWidth,
      height: shapeHeight,
      fill: shapeFillColor,
      stroke: '#000000',
      strokeWidth: 2
    })

    fabricCanvasRef.current.add(rect)
    fabricCanvasRef.current.setActiveObject(rect)
    fabricCanvasRef.current.renderAll()

    // Add to layers
    const newLayer: CanvasLayer = {
      id: `layer-${layerIdCounter}`,
      name: `Rectangle ${layerIdCounter}`,
      type: 'shape',
      visible: true,
      fabricObject: rect
    }
    
    setLayers(prev => [...prev, newLayer])
    setSelectedLayer(newLayer)
    setLayerIdCounter(prev => prev + 1)
    
    toast({
      title: "Rectangle Added",
      description: "Rectangle shape has been added to the canvas",
    })
  }

  // Update text properties when changed
  const updateTextProperty = (property: string, value: any) => {
    if (selectedLayer?.type === 'text' && selectedLayer.fabricObject) {
      selectedLayer.fabricObject.set(property, value)
      selectedLayer.fabricObject.setCoords() // Update bounding box after property change
      fabricCanvasRef.current?.renderAll()
    }
  }

  // Update shape properties when changed
  const updateShapeProperty = (property: string, value: any) => {
    if (selectedLayer?.type === 'shape' && selectedLayer.fabricObject) {
      if (property === 'width' || property === 'height') {
        // Reset scale to 1 and set the exact dimension
        // This ensures the slider value matches the actual rendered size
        if (property === 'width') {
          selectedLayer.fabricObject.set({
            width: value,
            scaleX: 1
          })
        } else {
          selectedLayer.fabricObject.set({
            height: value,
            scaleY: 1
          })
        }
      } else {
        selectedLayer.fabricObject.set(property, value)
      }
      selectedLayer.fabricObject.setCoords() // Update bounding box after property change
      fabricCanvasRef.current?.renderAll()
    }
  }

  // Sync text controls when a text layer is selected
  useEffect(() => {
    if (selectedLayer?.type === 'text' && selectedLayer.fabricObject) {
      const textObj = selectedLayer.fabricObject
      setTextFontFamily(textObj.fontFamily || 'Arial')
      setTextFontSize(textObj.fontSize || 32)
      setTextColor(textObj.fill || '#000000')
      setTextRotation(textObj.angle || 0)
    }
  }, [selectedLayer])

  // Sync shape controls when a shape layer is selected
  useEffect(() => {
    if (selectedLayer?.type === 'shape' && selectedLayer.fabricObject) {
      const shapeObj = selectedLayer.fabricObject
      // Use scaled dimensions to show the actual rendered size
      const scaledWidth = Math.round((shapeObj.width || 200) * (shapeObj.scaleX || 1))
      const scaledHeight = Math.round((shapeObj.height || 150) * (shapeObj.scaleY || 1))
      setShapeWidth(scaledWidth)
      setShapeHeight(scaledHeight)
      setShapeFillColor(shapeObj.fill || '#8B5CF6')
    }
  }, [selectedLayer])

  const handleToggleLayerVisibility = (layer: CanvasLayer) => {
    const newVisibility = !layer.visible
    layer.fabricObject.set('visible', newVisibility)
    fabricCanvasRef.current?.renderAll()
    
    setLayers(prev => 
      prev.map(l => 
        l.id === layer.id ? { ...l, visible: newVisibility } : l
      )
    )
  }

  const handleDeleteLayer = (layer: CanvasLayer) => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.remove(layer.fabricObject)
      setLayers(prev => prev.filter(l => l.id !== layer.id))
      if (selectedLayer?.id === layer.id) {
        setSelectedLayer(null)
      }
      
      toast({
        title: "Layer Deleted",
        description: `${layer.name} has been removed`,
      })
    }
  }

  const handleDuplicateLayer = async (layer: CanvasLayer) => {
    if (!fabricCanvasRef.current) return

    try {
      const cloned = await layer.fabricObject.clone()
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      })

      fabricCanvasRef.current.add(cloned)
      fabricCanvasRef.current.setActiveObject(cloned)
      fabricCanvasRef.current.renderAll()

      const newLayer: CanvasLayer = {
        id: `layer-${layerIdCounter}`,
        name: `${layer.name} Copy`,
        type: layer.type,
        visible: true,
        fabricObject: cloned
      }
      
      setLayers(prev => [...prev, newLayer])
      setSelectedLayer(newLayer)
      setLayerIdCounter(prev => prev + 1)
      
      toast({
        title: "Layer Duplicated",
        description: `${layer.name} has been duplicated`,
      })
    } catch (error) {
      console.error('Failed to duplicate layer:', error)
      toast({
        title: "Error",
        description: "Failed to duplicate layer",
        variant: "destructive"
      })
    }
  }

  const handleLayerDragStart = (e: React.DragEvent, layerId: string) => {
    setDraggedLayerId(layerId)
    e.dataTransfer.effectAllowed = 'copy'
    // Store layer ID for library drop
    e.dataTransfer.setData('layerId', layerId)
    // Visual debug - change document title
    document.title = '🔵 DRAGGING LAYER'
  }

  const handleLayerDragOver = (e: React.DragEvent, layerId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverLayerId(layerId)
  }

  const handleLayerDragLeave = () => {
    setDragOverLayerId(null)
  }

  const handleLayerDrop = (e: React.DragEvent, dropLayerId: string) => {
    e.preventDefault()
    
    if (!draggedLayerId || draggedLayerId === dropLayerId || !fabricCanvasRef.current) {
      setDraggedLayerId(null)
      setDragOverLayerId(null)
      return
    }

    const draggedIndex = layers.findIndex(l => l.id === draggedLayerId)
    const dropIndex = layers.findIndex(l => l.id === dropLayerId)

    if (draggedIndex === -1 || dropIndex === -1) {
      setDraggedLayerId(null)
      setDragOverLayerId(null)
      return
    }

    // Create new layers array with reordered items
    const newLayers = [...layers]
    const [draggedLayer] = newLayers.splice(draggedIndex, 1)
    newLayers.splice(dropIndex, 0, draggedLayer)

    // Update React state
    setLayers(newLayers)

    // Update Fabric.js canvas z-order
    // Fabric.js v6 approach: Remove all objects and re-add in new order
    const canvas = fabricCanvasRef.current
    const newObjectsOrder = newLayers.map(l => l.fabricObject)
    
    // Set flag to prevent layer sync during reorder
    isReorderingRef.current = true
    
    try {
      // Store selection state
      const activeObject = canvas.getActiveObject()
      
      // Remove all objects from canvas (but don't dispose them)
      canvas.remove(...canvas.getObjects())
      
      // Re-add objects in new order (bottom to top)
      newObjectsOrder.forEach(obj => {
        canvas.add(obj)
      })
      
      // Restore selection if it was active
      if (activeObject && newObjectsOrder.includes(activeObject)) {
        canvas.setActiveObject(activeObject)
      }
      
      canvas.renderAll()
    } finally {
      // Always clear the flag, even if there's an error
      isReorderingRef.current = false
    }

    setDraggedLayerId(null)
    setDragOverLayerId(null)
  }

  const handleLayerDragEnd = () => {
    setDraggedLayerId(null)
    setDragOverLayerId(null)
  }

  const handleExportCanvas = () => {
    if (!fabricCanvasRef.current) return

    try {
      const dataURL = fabricCanvasRef.current.toDataURL({
        format: 'png',
        quality: 1.0,
        multiplier: 2 // Higher resolution
      })

      // Create download link
      const link = document.createElement('a')
      link.download = `canvas-export-${Date.now()}.png`
      link.href = dataURL
      link.click()
      
      toast({
        title: "Canvas Exported",
        description: "Your canvas has been exported as PNG",
      })
    } catch (error) {
      console.error('Export failed:', error)
      toast({
        title: "Export Failed",
        description: "Failed to export canvas. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleSaveToProduct = async () => {
    if (!fabricCanvasRef.current || !selectedProject) {
      toast({
        title: "Save Failed",
        description: "Please select a project first",
        variant: "destructive"
      })
      return
    }

    setIsSavingToProduct(true)
    try {
      // Convert canvas to blob
      const canvas = fabricCanvasRef.current.getElement()
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
        }, 'image/png', 1.0)
      })

      if (!blob) {
        throw new Error('Failed to create image from canvas')
      }

      // Create FormData for upload
      const formData = new FormData()
      formData.append('image', blob, `canvas_${Date.now()}.png`)
      formData.append('projectId', selectedProject.id)

      // Upload to API
      const response = await fetch('/api/canvas/save-to-project', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (result.success) {
        toast({
          title: "Image Saved",
          description: result.message || `Canvas image saved to ${selectedProject.name}`,
          duration: 4000,
        })
      }
    } catch (error) {
      console.error('Failed to save to project:', error)
      toast({
        title: "Save Failed",
        description: "Could not save canvas image to project files",
        variant: "destructive",
      })
    } finally {
      setIsSavingToProduct(false)
    }
  }

  const handleAttachCanvas = async (): Promise<string> => {
    if (!fabricCanvasRef.current) {
      throw new Error('No canvas available')
    }

    return new Promise((resolve, reject) => {
      const canvas = fabricCanvasRef.current!.getElement()
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create canvas blob'))
          return
        }

        // Create a data URL for immediate display
        const dataURL = canvas.toDataURL('image/png', 1.0)
        resolve(dataURL)
      }, 'image/png', 1.0)
    })
  }

  const handleSaveGeneratedImage = async (imageUrl: string): Promise<void> => {
    if (!selectedProduct) {
      throw new Error('No product selected')
    }

    try {
      // Use the new endpoint that handles download and save server-side
      const response = await fetch('/api/chat/save-generated-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageUrl,
          selectedProductId: selectedProduct.id,
          selectedProjectId: selectedProject?.id
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Save failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(`Save operation failed: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to save generated image:', error)
      throw error
    }
  }

  const handleSaveToCanvas = async (imageUrl: string): Promise<void> => {
    if (!fabricCanvasRef.current) {
      throw new Error('Canvas not available')
    }

    try {
      const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' })
      
      // Scale image to fit canvas while maintaining aspect ratio
      const canvas = fabricCanvasRef.current
      const maxWidth = canvas.getWidth() * 0.8
      const maxHeight = canvas.getHeight() * 0.8
      
      const scaleX = maxWidth / (img.width || 1)
      const scaleY = maxHeight / (img.height || 1)
      const scale = Math.min(scaleX, scaleY)
      
      img.set({
        scaleX: scale,
        scaleY: scale,
        left: (canvas.getWidth() - (img.width || 0) * scale) / 2,
        top: (canvas.getHeight() - (img.height || 0) * scale) / 2
      })

      canvas.add(img)
      canvas.setActiveObject(img)
      canvas.renderAll()

      // Add to layers
      const newLayer: CanvasLayer = {
        id: `layer-${layerIdCounter}`,
        name: `Generated Image ${layerIdCounter}`,
        type: 'image',
        visible: true,
        fabricObject: img
      }
      
      setLayers(prev => [...prev, newLayer])
      setSelectedLayer(newLayer)
      setLayerIdCounter(prev => prev + 1)
      
      // Toast is handled by ChatWindow component
    } catch (error) {
      console.error('Failed to add image to canvas:', error)
      throw error
    }
  }

  const handleSaveToMediaLibrary = async (imageUrl: string, prompt: string): Promise<void> => {
    try {
      // Create an ImageProject record to save to Media Library
      const response = await fetch('/api/image-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceImageUrl: imageUrl,
          description: prompt,
          aspectRatio: selectedSize.ratio || '1:1',
          status: 'completed',
          generatedImageUrl: imageUrl
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save to Media Library')
      }

      // Invalidate image projects cache to refresh Media Library
      await queryClient.invalidateQueries({ queryKey: ["/api/image-projects"] })
      
      // Success toast is handled by ChatWindow component
    } catch (error) {
      console.error('Failed to save to Media Library:', error)
      throw error
    }
  }

  const handleBringForward = (layer: CanvasLayer) => {
    if (fabricCanvasRef.current) {
      layer.fabricObject.bringForward()
      fabricCanvasRef.current.renderAll()
    }
  }

  const handleSendBackward = (layer: CanvasLayer) => {
    if (fabricCanvasRef.current) {
      layer.fabricObject.sendBackwards()
      fabricCanvasRef.current.renderAll()
    }
  }

  // Library handlers
  const handleLibraryFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select a PNG or JPEG image",
        variant: "destructive"
      })
      return
    }

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only PNG and JPEG files are supported",
        variant: "destructive"
      })
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name)

      const response = await fetch('/api/branding-assets', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to upload image')
      }

      await refetchLibraryAssets()
      
      toast({
        title: "Success",
        description: "Image added to library"
      })

      // Reset file input
      if (libraryFileInputRef.current) {
        libraryFileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Failed to upload library image:', error)
      toast({
        title: "Error",
        description: "Failed to upload image to library",
        variant: "destructive"
      })
    }
  }

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const validFiles: File[] = []
    const invalidFiles: string[] = []

    // Validate all files first
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/') || !['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
        invalidFiles.push(file.name)
      } else {
        validFiles.push(file)
      }
    })

    // Show warning if there are invalid files
    if (invalidFiles.length > 0) {
      toast({
        title: "Some files skipped",
        description: `${invalidFiles.length} file(s) are not valid images (PNG/JPEG only)`,
        variant: "destructive"
      })
    }

    if (validFiles.length === 0) return

    try {
      let successCount = 0
      let failCount = 0

      // Upload all valid files in parallel
      const uploadPromises = validFiles.map(async (file) => {
        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('name', file.name)

          const response = await fetch('/api/branding-assets', {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            throw new Error('Failed to upload')
          }
          
          successCount++
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error)
          failCount++
        }
      })

      await Promise.all(uploadPromises)
      await refetchLibraryAssets()

      // Show summary toast
      if (successCount > 0) {
        toast({
          title: "Upload Complete",
          description: `${successCount} image(s) added to library${failCount > 0 ? `, ${failCount} failed` : ''}`,
          duration: 5000
        })
      } else if (failCount > 0) {
        toast({
          title: "Upload Failed",
          description: `All ${failCount} file(s) failed to upload. Please try again.`,
          variant: "destructive"
        })
      }

      // Reset file input
      if (bulkFileInputRef.current) {
        bulkFileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Bulk upload error:', error)
      toast({
        title: "Error",
        description: "Failed to upload images to library",
        variant: "destructive"
      })
    }
  }

  const handleAddLibraryImageToCanvas = async (imageUrl: string, imageName: string) => {
    if (!fabricCanvasRef.current) return

    try {
      console.log('Adding library image to canvas:', imageUrl)
      
      // Test if the image URL is accessible first
      const testResponse = await fetch(imageUrl)
      if (!testResponse.ok) {
        throw new Error(`Image not accessible: ${testResponse.status} ${testResponse.statusText}`)
      }
      
      const img = await FabricImage.fromURL(imageUrl)

      const canvasWidth = fabricCanvasRef.current.width || 800
      const canvasHeight = fabricCanvasRef.current.height || 800
      const imgWidth = img.width || 0
      const imgHeight = img.height || 0
      
      console.log('Image loaded:', { imgWidth, imgHeight, canvasWidth, canvasHeight })
      
      // Scale image to fit canvas if it's too large
      // Leave 10% padding on each side for better UX
      const maxWidth = canvasWidth * 0.8
      const maxHeight = canvasHeight * 0.8
      
      let scale = 1
      if (imgWidth > maxWidth || imgHeight > maxHeight) {
        const widthScale = maxWidth / imgWidth
        const heightScale = maxHeight / imgHeight
        scale = Math.min(widthScale, heightScale)
        console.log('Scaling image down:', scale)
      }
      
      // Apply scale and center the image
      img.scale(scale)
      img.set({
        left: (canvasWidth - (imgWidth * scale)) / 2,
        top: (canvasHeight - (imgHeight * scale)) / 2
      })

      fabricCanvasRef.current.add(img)
      fabricCanvasRef.current.setActiveObject(img)
      fabricCanvasRef.current.renderAll()

      const newLayer: CanvasLayer = {
        id: `layer-${layerIdCounter}`,
        name: imageName || `Library Image ${layerIdCounter}`,
        type: 'image',
        visible: true,
        fabricObject: img
      }

      setLayers(prev => [...prev, newLayer])
      setSelectedLayer(newLayer)
      setLayerIdCounter(prev => prev + 1)

      toast({
        title: "Success",
        description: "Image added to canvas"
      })
    } catch (error) {
      console.error('Failed to add library image to canvas:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add image to canvas",
        variant: "destructive"
      })
    }
  }

  const handleDeleteLibraryAsset = async (assetId: string) => {
    try {
      const response = await fetch(`/api/branding-assets/${assetId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete asset')
      }

      await refetchLibraryAssets()
      
      toast({
        title: "Success",
        description: "Image removed from library"
      })
    } catch (error) {
      console.error('Failed to delete library asset:', error)
      toast({
        title: "Error",
        description: "Failed to delete image",
        variant: "destructive"
      })
    }
  }

  const handleExportLayerToLibrary = async (layer: CanvasLayer) => {
    try {
      if (!fabricCanvasRef.current) {
        throw new Error('Canvas not initialized')
      }

      // Clone the object to export it independently
      const obj = layer.fabricObject
      
      // Calculate bounding box
      const boundingRect = obj.getBoundingRect()
      
      // Create temporary canvas for this object
      const tempCanvas = document.createElement('canvas')
      const padding = 20 // Add some padding around the object
      tempCanvas.width = boundingRect.width + (padding * 2)
      tempCanvas.height = boundingRect.height + (padding * 2)
      
      const tempContext = tempCanvas.getContext('2d')
      if (!tempContext) {
        throw new Error('Failed to get canvas context')
      }

      // Fill with transparent background
      tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
      
      // Save current object state
      const originalLeft = obj.left
      const originalTop = obj.top
      
      // Temporarily move object to origin for rendering
      obj.set({
        left: padding,
        top: padding
      })
      obj.setCoords()
      
      // Render the object to the temp canvas
      obj.render(tempContext)
      
      // Restore original position
      obj.set({
        left: originalLeft,
        top: originalTop
      })
      obj.setCoords()
      
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        tempCanvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create blob'))
          }
        }, 'image/png', 1.0)
      })

      // Upload to library
      const formData = new FormData()
      formData.append('file', blob, `${layer.name}.png`)
      formData.append('name', layer.name)
      formData.append('tags', JSON.stringify(['canvas-export']))

      const response = await fetch('/api/branding-assets', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to upload to library')
      }

      await refetchLibraryAssets()
      
      toast({
        title: "Success",
        description: `"${layer.name}" added to library`
      })
    } catch (error) {
      console.error('Failed to export layer to library:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add to library",
        variant: "destructive"
      })
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, imageUrl: string, imageName: string) => {
    e.dataTransfer.setData('imageUrl', imageUrl)
    e.dataTransfer.setData('imageName', imageName)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDraggingOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)

    const imageUrl = e.dataTransfer.getData('imageUrl')
    const imageName = e.dataTransfer.getData('imageName')

    if (imageUrl && imageName) {
      await handleAddLibraryImageToCanvas(imageUrl, imageName)
    }
  }

  // Library drop zone handlers
  const handleLibraryDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Check if we're dragging a layer - use state as it's more reliable
    if (draggedLayerId) {
      e.dataTransfer.dropEffect = 'copy'
      setIsDraggingToLibrary(true)
      // Visual debug - change document title to confirm event fires
      document.title = '🟢 DRAG OVER LIBRARY'
    }
  }

  const handleLibraryDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Only reset if actually leaving the library panel (not just entering a child)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDraggingToLibrary(false)
    }
  }

  const handleLibraryDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingToLibrary(false)

    // Get layer ID from dataTransfer
    const layerId = e.dataTransfer.getData('layerId')
    
    if (layerId) {
      const layer = layers.find(l => l.id === layerId)
      if (layer) {
        await handleExportLayerToLibrary(layer)
      }
    }
    
    setDraggedLayerId(null)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Canvas Editor</h1>
          <p className="text-muted-foreground mb-3">
            A powerful image editor with layers, perfect for creating professional product designs. Add text, images, shapes, and AI-generated content to build exactly what you need.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-2">
            <div className="flex items-center gap-1">
              <Layers className="w-4 h-4 text-primary" />
              <span>Layer-based editing</span>
            </div>
            <div className="flex items-center gap-1">
              <Type className="w-4 h-4 text-primary" />
              <span>Custom text styles</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4 text-primary" />
              <span>AI image generation (GPT-4o)</span>
            </div>
            <div className="flex items-center gap-1">
              <Package className="w-4 h-4 text-primary" />
              <span>Export to products</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            className="bg-primary text-primary-foreground hover-elevate active-elevate-2"
            onClick={() => setIsLibraryOpen(!isLibraryOpen)} 
            data-testid="button-toggle-library"
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Library
          </Button>
          <Button 
            className="bg-primary text-primary-foreground hover-elevate active-elevate-2"
            onClick={handleExportCanvas} 
            data-testid="button-export-canvas"
          >
            <Download className="w-4 h-4 mr-2" />
            Export PNG
          </Button>
          <Button 
            className="bg-accent text-accent-foreground hover-elevate active-elevate-2"
            onClick={() => setIsChatOpen(true)} 
            data-testid="button-open-chat"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            AI Chat
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Toolbox */}
        <div className="lg:col-span-1 space-y-4">
          {/* Canvas Size */}
          <Card className="bg-muted/40 dark:bg-muted/20">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Square className="w-4 h-4" />
                Canvas Size
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Preset Size</Label>
                <Select 
                  value={selectedSize.name} 
                  onValueChange={(value) => {
                    const size = CANVAS_SIZES.find(s => s.name === value)
                    if (size) setSelectedSize(size)
                  }}
                >
                  <SelectTrigger data-testid="select-canvas-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CANVAS_SIZES.map((size) => (
                      <SelectItem key={size.name} value={size.name}>
                        {size.name} ({size.ratio})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedSize.width} × {selectedSize.height} px
              </div>
            </CardContent>
          </Card>

          {/* Project Selection */}
          <Card className="bg-muted/40 dark:bg-muted/20">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Project Selection */}
              <div className="space-y-2">
                <Label>Project</Label>
                <Select
                  value={selectedProject?.id || ""}
                  onValueChange={(projectId) => {
                    const project = projects.find(p => p.id === projectId)
                    setSelectedProject(project || null)
                  }}
                  data-testid="select-project"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSaveToProduct}
                disabled={!selectedProject || isSavingToProduct}
                className="w-full"
                data-testid="button-save-canvas"
              >
                {isSavingToProduct ? "Saving..." : "Save to Project Files"}
              </Button>

              {selectedProject && (
                <div className="text-xs text-muted-foreground">
                  Will save to: {selectedProject.name}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Content */}
          <Card className="bg-muted/40 dark:bg-muted/20">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image Upload */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <Button 
                  className="w-full bg-primary text-primary-foreground hover-elevate active-elevate-2"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-image"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Add Image
                </Button>
              </div>

              {/* Printful Import */}
              <div>
                <Button 
                  className="w-full bg-primary text-primary-foreground hover-elevate active-elevate-2"
                  onClick={() => setIsPrintfulBrowserOpen(true)}
                  data-testid="button-import-printful"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Import Printful Product
                </Button>
              </div>

              <Separator />

              {/* Text Input */}
              <div className="space-y-2">
                <Label>Add Text</Label>
                <div className="flex gap-2">
                  <Input
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Enter text..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddText()}
                    data-testid="input-text"
                  />
                  <Button 
                    size="sm"
                    className="bg-accent text-accent-foreground hover-elevate active-elevate-2"
                    onClick={handleAddText}
                    disabled={!textInput.trim()}
                    data-testid="button-add-text"
                  >
                    <Type className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Add Rectangle */}
              <div>
                <Button 
                  className="w-full bg-accent text-accent-foreground hover-elevate active-elevate-2"
                  onClick={handleAddRectangle}
                  data-testid="button-add-rectangle"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Add Rectangle
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Selected Item Controls */}
          {selectedLayer && (
            <Card className="bg-muted/40 dark:bg-muted/20">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Selected: {selectedLayer.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  className="w-full hover-elevate active-elevate-2"
                  onClick={() => handleDeleteLayer(selectedLayer)}
                  data-testid="button-delete-selected"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected Item
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Text Editing Controls */}
          {selectedLayer?.type === 'text' && (
            <Card className="bg-muted/40 dark:bg-muted/20">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Text Properties
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Font Family */}
                <div className="space-y-2">
                  <Label>Font</Label>
                  <Select
                    value={textFontFamily}
                    onValueChange={(value) => {
                      setTextFontFamily(value)
                      updateTextProperty('fontFamily', value)
                    }}
                  >
                    <SelectTrigger data-testid="select-font-family">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {FONT_FAMILIES.map((font) => (
                        <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                          {font}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Font Size */}
                <div className="space-y-2">
                  <Label>Font Size: {textFontSize}px</Label>
                  <input
                    type="range"
                    min="12"
                    max="200"
                    value={textFontSize}
                    onChange={(e) => {
                      const size = Number(e.target.value)
                      setTextFontSize(size)
                      updateTextProperty('fontSize', size)
                    }}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                    data-testid="input-font-size"
                  />
                </div>

                {/* Font Color */}
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={textColor}
                      onChange={(e) => {
                        setTextColor(e.target.value)
                        updateTextProperty('fill', e.target.value)
                      }}
                      className="w-16 h-9 cursor-pointer"
                      data-testid="input-text-color"
                    />
                    <Input
                      type="text"
                      value={textColor}
                      onChange={(e) => {
                        setTextColor(e.target.value)
                        updateTextProperty('fill', e.target.value)
                      }}
                      className="flex-1"
                      placeholder="#000000"
                      data-testid="input-text-color-hex"
                    />
                  </div>
                </div>

                {/* Rotation */}
                <div className="space-y-2">
                  <Label>Rotation: {textRotation}°</Label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={textRotation}
                    onChange={(e) => {
                      const angle = Number(e.target.value)
                      setTextRotation(angle)
                      updateTextProperty('angle', angle)
                    }}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                    data-testid="input-text-rotation"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shape Editing Controls */}
          {selectedLayer?.type === 'shape' && (
            <Card className="bg-muted/40 dark:bg-muted/20">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Square className="w-4 h-4" />
                  Shape Properties
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Width */}
                <div className="space-y-2">
                  <Label>Width: {shapeWidth}px</Label>
                  <input
                    type="range"
                    min="20"
                    max="800"
                    value={shapeWidth}
                    onInput={(e) => {
                      const width = Number((e.target as HTMLInputElement).value)
                      setShapeWidth(width)
                      updateShapeProperty('width', width)
                    }}
                    onChange={(e) => {
                      const width = Number(e.target.value)
                      setShapeWidth(width)
                      updateShapeProperty('width', width)
                    }}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                    data-testid="input-shape-width"
                  />
                </div>

                {/* Height */}
                <div className="space-y-2">
                  <Label>Height: {shapeHeight}px</Label>
                  <input
                    type="range"
                    min="20"
                    max="800"
                    value={shapeHeight}
                    onInput={(e) => {
                      const height = Number((e.target as HTMLInputElement).value)
                      setShapeHeight(height)
                      updateShapeProperty('height', height)
                    }}
                    onChange={(e) => {
                      const height = Number(e.target.value)
                      setShapeHeight(height)
                      updateShapeProperty('height', height)
                    }}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                    data-testid="input-shape-height"
                  />
                </div>

                {/* Fill Color */}
                <div className="space-y-2">
                  <Label>Fill Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={shapeFillColor}
                      onChange={(e) => {
                        setShapeFillColor(e.target.value)
                        updateShapeProperty('fill', e.target.value)
                      }}
                      className="w-16 h-9 cursor-pointer"
                      data-testid="input-shape-color"
                    />
                    <Input
                      type="text"
                      value={shapeFillColor}
                      onChange={(e) => {
                        setShapeFillColor(e.target.value)
                        updateShapeProperty('fill', e.target.value)
                      }}
                      className="flex-1"
                      placeholder="#8B5CF6"
                      data-testid="input-shape-color-hex"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Layers Panel */}
          <Card className="bg-muted/40 dark:bg-muted/20">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Layers ({layers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {layers.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No layers yet. Add an image or text to get started.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {layers.map((layer) => (
                      <div
                        key={layer.id}
                        draggable="true"
                        onDragStart={(e) => handleLayerDragStart(e, layer.id)}
                        onDragOver={(e) => handleLayerDragOver(e, layer.id)}
                        onDragLeave={handleLayerDragLeave}
                        onDrop={(e) => handleLayerDrop(e, layer.id)}
                        onDragEnd={handleLayerDragEnd}
                        className={`flex items-center gap-2 p-2 rounded border cursor-move ${
                          selectedLayer?.id === layer.id 
                            ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/20' 
                            : dragOverLayerId === layer.id
                              ? 'bg-primary/20 border-primary/60'
                              : 'bg-background hover:bg-muted/50 border-border'
                        } ${draggedLayerId === layer.id ? 'opacity-50' : ''}`}
                        data-testid={`layer-${layer.id}`}
                        data-selected={selectedLayer?.id === layer.id}
                        onClick={(e) => {
                          // Only select if not dragging
                          if (!draggedLayerId && fabricCanvasRef.current && layer.fabricObject) {
                            fabricCanvasRef.current.setActiveObject(layer.fabricObject)
                            fabricCanvasRef.current.renderAll()
                            setSelectedLayer(layer)
                          }
                        }}
                      >
                        <Button
                          size="sm"
                          className="h-6 w-6 p-0 bg-primary/20 text-primary hover-elevate active-elevate-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleLayerVisibility(layer)
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          data-testid={`button-toggle-visibility-${layer.id}`}
                        >
                          {layer.visible ? (
                            <Eye className="w-3 h-3" />
                          ) : (
                            <EyeOff className="w-3 h-3" />
                          )}
                        </Button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {layer.name}
                          </div>
                          <Badge className="h-4 text-xs bg-primary/30 text-primary-foreground border-primary/40">
                            {layer.type}
                          </Badge>
                        </div>
                        
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            className="h-6 w-6 p-0 bg-accent/30 text-accent-foreground hover-elevate active-elevate-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDuplicateLayer(layer)
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            data-testid={`button-duplicate-${layer.id}`}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            className="h-6 w-6 p-0 bg-destructive/30 text-destructive-foreground hover-elevate active-elevate-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteLayer(layer)
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            data-testid={`button-delete-${layer.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Canvas Area */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-center">
                <div 
                  ref={canvasContainerRef}
                  className={`relative border-2 border-dashed rounded-lg shadow-lg transition-colors ${
                    isDraggingOver 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border bg-white'
                  }`}
                  style={{ 
                    width: selectedSize.width + 40,
                    height: selectedSize.height + 40,
                    padding: '20px'
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <canvas
                    ref={canvasRef}
                    className="border border-border rounded"
                    data-testid="fabric-canvas"
                  />
                  {isDraggingOver && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-primary font-semibold text-lg">
                        Drop image here
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Chat Window - Canvas uses nano-banana through Kie */}
      <ChatWindow
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onAttachCanvas={handleAttachCanvas}
        onSaveImage={handleSaveGeneratedImage}
        onSaveToCanvas={handleSaveToCanvas}
        onSaveToMediaLibrary={handleSaveToMediaLibrary}
        imageGenerationEndpoint="/api/canvas/start-image-generation"
        hideModelSelector={true}
        forcedModel="nano-banana"
        canvasAspectRatio={selectedSize.ratio}
      />

      {/* Printful Browser */}
      <PrintfulBrowser
        isOpen={isPrintfulBrowserOpen}
        onClose={() => setIsPrintfulBrowserOpen(false)}
        onImport={handlePrintfulImport}
      />

      {/* Library Panel - High z-index drop zone */}
      {isLibraryOpen && (
        <div 
          className={`fixed top-20 right-6 w-96 max-h-[80vh] bg-card border rounded-lg shadow-2xl flex flex-col transition-colors pointer-events-auto ${
            isDraggingToLibrary 
              ? 'border-primary border-2 bg-primary/5' 
              : 'border-border'
          }`}
          style={{ 
            zIndex: 99999,
            isolation: 'isolate'
          }}
          onDragOver={handleLibraryDragOver}
          onDragLeave={handleLibraryDragLeave}
          onDrop={handleLibraryDrop}
          data-testid="library-panel"
        >
          <div className="p-4 border-b border-border bg-muted/40 dark:bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Image Library
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => setIsLibraryOpen(false)}
                data-testid="button-close-library"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Drag items from canvas layers to save them here
            </p>
          </div>

          {isDraggingToLibrary && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-primary/10 z-10 rounded-lg">
              <div className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold text-lg shadow-lg">
                Drop to add to library
              </div>
            </div>
          )}

          <div className="p-4 border-b border-border space-y-2">
            <input
              ref={libraryFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleLibraryFileSelect}
              className="hidden"
              data-testid="input-library-file"
            />
            <input
              ref={bulkFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              multiple
              onChange={handleBulkUpload}
              className="hidden"
              data-testid="input-bulk-upload"
            />
            <Button
              className="w-full bg-primary text-primary-foreground hover-elevate active-elevate-2"
              onClick={() => libraryFileInputRef.current?.click()}
              data-testid="button-upload-library"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Image
            </Button>
            <Button
              variant="outline"
              className="w-full hover-elevate active-elevate-2"
              onClick={() => bulkFileInputRef.current?.click()}
              data-testid="button-bulk-upload"
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4">
            {libraryAssets.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No images in library</p>
                <p className="text-xs mt-1">Upload PNG or JPEG files to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {libraryAssets.map((asset: any) => (
                  <div
                    key={asset.id}
                    className="relative group rounded-lg overflow-hidden border border-border hover-elevate cursor-move"
                    draggable
                    onDragStart={(e) => handleDragStart(e, asset.publicUrl, asset.name)}
                    onClick={() => handleAddLibraryImageToCanvas(asset.publicUrl, asset.name)}
                    data-testid={`library-asset-${asset.id}`}
                  >
                    <div className="aspect-square bg-muted">
                      <img
                        src={asset.publicUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover pointer-events-none"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <Button
                          size="sm"
                          className="h-8 w-8 p-0 bg-destructive/80 text-destructive-foreground hover-elevate active-elevate-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteLibraryAsset(asset.id)
                          }}
                          data-testid={`button-delete-library-${asset.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2">
                      <p className="text-xs text-white truncate">{asset.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}