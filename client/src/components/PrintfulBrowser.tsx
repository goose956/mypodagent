import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { Search, Package, Loader2 } from 'lucide-react'

interface PrintfulProduct {
  id: number
  type: string
  type_name: string
  title: string
  brand: string | null
  model: string
  image: string
  variant_count: number
  currency: string
  is_discontinued: boolean
  description: string
}

interface PrintfulVariant {
  id: number
  product_id: number
  name: string
  size: string
  color: string
  color_code: string
  image: string
  price: string
  in_stock: boolean
}

interface PrintfulProductDetail {
  product: PrintfulProduct
  variants: PrintfulVariant[]
}

interface PrintfulBrowserProps {
  isOpen: boolean
  onClose: () => void
  onImport: (productImage: string, productData: any) => void
}

export function PrintfulBrowser({ isOpen, onClose, onImport }: PrintfulBrowserProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<PrintfulProduct | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<PrintfulVariant | null>(null)
  const { toast } = useToast()

  const { data: products = [], isLoading: productsLoading } = useQuery<PrintfulProduct[]>({
    queryKey: ['/api/printful/products'],
    enabled: isOpen,
  })

  const { data: productDetail, isLoading: detailLoading } = useQuery<PrintfulProductDetail>({
    queryKey: ['/api/printful/products', selectedProduct?.id],
    enabled: !!selectedProduct,
  })

  const filteredProducts = products.filter(product => 
    !product.is_discontinued &&
    (product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
     product.type_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleProductSelect = (product: PrintfulProduct) => {
    setSelectedProduct(product)
    setSelectedVariant(null)
  }

  const handleImport = () => {
    if (!selectedVariant) {
      toast({
        title: 'Select a variant',
        description: 'Please select a product variant before importing',
        variant: 'destructive'
      })
      return
    }

    onImport(selectedVariant.image, {
      productId: selectedProduct?.id,
      variantId: selectedVariant.id,
      productName: selectedProduct?.title,
      variantName: selectedVariant.name,
      size: selectedVariant.size,
      color: selectedVariant.color,
      price: selectedVariant.price
    })

    toast({
      title: 'Product imported',
      description: `${selectedProduct?.title} - ${selectedVariant.name} added to canvas`
    })

    onClose()
    setSelectedProduct(null)
    setSelectedVariant(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Import Printful Products
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 h-full">
          {/* Products List */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-products"
              />
            </div>

            <ScrollArea className="flex-1">
              {productsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pr-4">
                  {filteredProducts.map((product) => (
                    <Card
                      key={product.id}
                      className={`cursor-pointer hover-elevate active-elevate-2 ${
                        selectedProduct?.id === product.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => handleProductSelect(product)}
                      data-testid={`card-product-${product.id}`}
                    >
                      <CardContent className="p-3">
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-full h-32 object-contain mb-2"
                        />
                        <h3 className="font-medium text-sm line-clamp-2">{product.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{product.type_name}</p>
                        <p className="text-xs text-muted-foreground">{product.variant_count} variants</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Product Details & Variants */}
          <div className="flex-1 flex flex-col gap-4">
            {selectedProduct ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{selectedProduct.title}</h3>
                    <p className="text-sm text-muted-foreground">{selectedProduct.type_name}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      onClick={onClose}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={!selectedVariant}
                      data-testid="button-import"
                    >
                      Import to Canvas
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  {detailLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-3 pr-4">
                      <h4 className="font-medium">Select Variant:</h4>
                      {productDetail?.variants.map((variant) => (
                        <Card
                          key={variant.id}
                          className={`cursor-pointer hover-elevate active-elevate-2 ${
                            selectedVariant?.id === variant.id ? 'ring-2 ring-primary' : ''
                          } ${!variant.in_stock ? 'opacity-50' : ''}`}
                          onClick={() => setSelectedVariant(variant)}
                          data-testid={`card-variant-${variant.id}`}
                        >
                          <CardContent className="p-3 flex gap-3">
                            <img
                              src={variant.image}
                              alt={variant.name}
                              className="w-20 h-20 object-contain"
                            />
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{variant.name}</h4>
                              <p className="text-xs text-muted-foreground">Size: {variant.size}</p>
                              <p className="text-xs text-muted-foreground">Color: {variant.color}</p>
                              <p className="text-sm font-semibold mt-1">${variant.price}</p>
                              {!variant.in_stock && (
                                <p className="text-xs text-destructive">Out of stock</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Select a product to view variants</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
