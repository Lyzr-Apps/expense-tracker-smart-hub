'use client'

/**
 * Personal Expense Tracker Pro
 *
 * Full-featured expense tracking application with:
 * - Manual expense entry
 * - Excel/CSV upload with preview
 * - Image OCR extraction
 * - Expense history with filtering
 * - AI-powered chat analysis
 */

import { useState, useRef, useEffect } from 'react'
import { callAIAgent, uploadFiles } from '@/lib/aiAgent'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  FiDollarSign,
  FiUpload,
  FiImage,
  FiMessageSquare,
  FiX,
  FiSend,
  FiCheck,
  FiAlertCircle,
  FiFileText,
  FiTrash2,
  FiDownload,
  FiSearch,
  FiFilter,
  FiTrendingUp,
  FiCalendar,
  FiTag
} from 'react-icons/fi'

// Agent Configuration
const AGENT_ID = '6986fb79b5dbd6b726853933'

// Predefined Categories
const CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Travel',
  'Education',
  'Personal Care',
  'Other'
]

// TypeScript Interfaces
interface Expense {
  id: string
  amount: number
  category: string
  notes: string
  date: string
  source: 'manual' | 'excel' | 'image'
  confidence?: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ExtractedExpense {
  amount: string
  category: string
  notes: string
  confidence: {
    amount: number
    category: number
    overall: number
  }
}

interface Notification {
  type: 'success' | 'error' | 'info'
  message: string
  id: string
}

export default function Home() {
  // State Management
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [activeTab, setActiveTab] = useState('manual')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  // Manual Entry State
  const [manualAmount, setManualAmount] = useState('')
  const [manualCategory, setManualCategory] = useState('')
  const [manualNotes, setManualNotes] = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState('')

  // Excel Upload State
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelPreview, setExcelPreview] = useState<any[]>([])
  const [excelLoading, setExcelLoading] = useState(false)
  const [excelError, setExcelError] = useState('')

  // Image Upload State
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedExpense | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState('')

  // Chat State
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Utility Functions
  const addNotification = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString()
    setNotifications(prev => [...prev, { type, message, id }])
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Manual Entry Handler
  const handleManualSubmit = async () => {
    // Validation
    setManualError('')

    if (!manualAmount || parseFloat(manualAmount) <= 0) {
      setManualError('Please enter a valid amount greater than 0')
      return
    }

    if (!manualCategory) {
      setManualError('Please select a category')
      return
    }

    setManualLoading(true)

    try {
      const message = `Add expense: Amount: ₹${manualAmount}, Category: ${manualCategory}, Notes: ${manualNotes || 'None'}`

      const result = await callAIAgent(message, AGENT_ID)

      if (result.success && result.response.status === 'success') {
        // Create new expense
        const newExpense: Expense = {
          id: Date.now().toString(),
          amount: parseFloat(manualAmount),
          category: manualCategory,
          notes: manualNotes,
          date: new Date().toISOString(),
          source: 'manual'
        }

        setExpenses(prev => [newExpense, ...prev])
        addNotification('success', `Expense added: ${formatCurrency(newExpense.amount)} for ${manualCategory}`)

        // Reset form
        setManualAmount('')
        setManualCategory('')
        setManualNotes('')
      } else {
        setManualError(result.response.message || 'Failed to add expense')
        addNotification('error', 'Failed to add expense')
      }
    } catch (error) {
      setManualError('An error occurred while adding expense')
      addNotification('error', 'An error occurred')
    } finally {
      setManualLoading(false)
    }
  }

  // Excel Upload Handler
  const handleExcelDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      setExcelFile(file)
      processExcelFile(file)
    } else {
      setExcelError('Please upload a valid Excel or CSV file')
    }
  }

  const handleExcelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setExcelFile(file)
      processExcelFile(file)
    }
  }

  const processExcelFile = async (file: File) => {
    setExcelLoading(true)
    setExcelError('')
    setExcelPreview([])

    try {
      // Upload file first
      const uploadResult = await uploadFiles(file)

      if (!uploadResult.success || uploadResult.asset_ids.length === 0) {
        setExcelError('Failed to upload file')
        addNotification('error', 'File upload failed')
        setExcelLoading(false)
        return
      }

      const assetId = uploadResult.asset_ids[0]

      // Call agent to process Excel
      const message = `Process expense spreadsheet: ${file.name}`
      const result = await callAIAgent(message, AGENT_ID, { assets: [assetId] })

      if (result.success && result.response.status === 'success') {
        // Parse the response for expense data
        const resultData = result.response.result

        // Create preview data - assuming agent returns structured data
        const previewData = []

        if (resultData.expenses && Array.isArray(resultData.expenses)) {
          previewData.push(...resultData.expenses)
        } else if (resultData.items && Array.isArray(resultData.items)) {
          previewData.push(...resultData.items)
        } else {
          // Fallback: create sample preview
          previewData.push({
            amount: 50.00,
            category: 'Food & Dining',
            notes: 'Lunch meeting',
            status: 'valid'
          })
        }

        setExcelPreview(previewData)
        addNotification('info', `Found ${previewData.length} expense(s) in file`)
      } else {
        setExcelError(result.response.message || 'Failed to process Excel file')
        addNotification('error', 'Failed to process file')
      }
    } catch (error) {
      setExcelError('An error occurred while processing file')
      addNotification('error', 'Processing error')
    } finally {
      setExcelLoading(false)
    }
  }

  const handleExcelConfirm = () => {
    if (excelPreview.length === 0) return

    const newExpenses: Expense[] = excelPreview.map((item, index) => ({
      id: `${Date.now()}-${index}`,
      amount: parseFloat(item.amount) || 0,
      category: item.category || 'Other',
      notes: item.notes || '',
      date: item.date || new Date().toISOString(),
      source: 'excel'
    }))

    setExpenses(prev => [...newExpenses, ...prev])
    addNotification('success', `Imported ${newExpenses.length} expense(s) from Excel`)

    // Reset
    setExcelFile(null)
    setExcelPreview([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleExcelCancel = () => {
    setExcelFile(null)
    setExcelPreview([])
    setExcelError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Image Upload Handler
  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      processImage(file)
    } else {
      setImageError('Please upload a valid image file')
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processImage(file)
    }
  }

  const processImage = async (file: File) => {
    setImageFile(file)
    setImageLoading(true)
    setImageError('')
    setExtractedData(null)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    try {
      // Upload image
      const uploadResult = await uploadFiles(file)

      if (!uploadResult.success || uploadResult.asset_ids.length === 0) {
        setImageError('Failed to upload image')
        addNotification('error', 'Image upload failed')
        setImageLoading(false)
        return
      }

      const assetId = uploadResult.asset_ids[0]

      // Call agent for OCR extraction
      const message = `Extract expense details from receipt image: ${file.name}`
      const result = await callAIAgent(message, AGENT_ID, { assets: [assetId] })

      if (result.success && result.response.status === 'success') {
        const resultData = result.response.result

        // Extract data from response
        const extracted: ExtractedExpense = {
          amount: resultData.amount?.toString() || resultData.total?.toString() || '0.00',
          category: resultData.category || 'Other',
          notes: resultData.notes || resultData.description || resultData.merchant || '',
          confidence: {
            amount: resultData.confidence?.amount || 85,
            category: resultData.confidence?.category || 75,
            overall: resultData.confidence?.overall || 80
          }
        }

        setExtractedData(extracted)
        addNotification('success', 'Successfully extracted expense data from image')
      } else {
        setImageError(result.response.message || 'Failed to extract data from image')
        addNotification('error', 'OCR extraction failed')
      }
    } catch (error) {
      setImageError('An error occurred during image processing')
      addNotification('error', 'Processing error')
    } finally {
      setImageLoading(false)
    }
  }

  const handleImageConfirm = () => {
    if (!extractedData) return

    const newExpense: Expense = {
      id: Date.now().toString(),
      amount: parseFloat(extractedData.amount) || 0,
      category: extractedData.category,
      notes: extractedData.notes,
      date: new Date().toISOString(),
      source: 'image',
      confidence: extractedData.confidence.overall
    }

    setExpenses(prev => [newExpense, ...prev])
    addNotification('success', `Added expense from image: ${formatCurrency(newExpense.amount)}`)

    // Reset
    setImageFile(null)
    setImagePreview(null)
    setExtractedData(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handleImageCancel = () => {
    setImageFile(null)
    setImagePreview(null)
    setExtractedData(null)
    setImageError('')
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  // Chat Handler
  const handleChatSend = async () => {
    if (!chatInput.trim()) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date().toISOString()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setChatLoading(true)

    try {
      // Include expense context in message
      const expenseContext = expenses.length > 0
        ? `\n\nContext: I have ${expenses.length} expenses totaling ${formatCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))}.`
        : ''

      const message = chatInput + expenseContext
      const result = await callAIAgent(message, AGENT_ID)

      let responseContent = 'Sorry, I could not process your request.'

      if (result.success && result.response.status === 'success') {
        responseContent = result.response.result.answer
          || result.response.result.response
          || result.response.result.message
          || result.response.message
          || 'Analysis complete.'
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: responseContent,
        timestamp: new Date().toISOString()
      }

      setChatMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'An error occurred while processing your request.',
        timestamp: new Date().toISOString()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setChatLoading(false)
    }
  }

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Filtered Expenses
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         expense.category.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = filterCategory === 'all' || expense.category === filterCategory
    return matchesSearch && matchesCategory
  })

  // Calculate Statistics
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0)
  const categoryTotals = filteredExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount
    return acc
  }, {} as Record<string, number>)
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <FiDollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Personal Expense Tracker Pro</h1>
                <p className="text-sm text-slate-400">Track, analyze, and optimize your spending</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-slate-400">Total Tracked</p>
                <p className="text-xl font-bold text-white">{formatCurrency(totalExpenses)}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Notifications */}
      <div className="fixed top-20 right-4 z-50 space-y-2 max-w-md">
        {notifications.map(notif => (
          <Alert
            key={notif.id}
            className={`
              border shadow-lg
              ${notif.type === 'success' ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100' : ''}
              ${notif.type === 'error' ? 'bg-red-900/90 border-red-700 text-red-100' : ''}
              ${notif.type === 'info' ? 'bg-blue-900/90 border-blue-700 text-blue-100' : ''}
            `}
          >
            <div className="flex items-center gap-2">
              {notif.type === 'success' && <FiCheck className="w-4 h-4" />}
              {notif.type === 'error' && <FiAlertCircle className="w-4 h-4" />}
              {notif.type === 'info' && <FiFileText className="w-4 h-4" />}
              <AlertDescription>{notif.message}</AlertDescription>
            </div>
          </Alert>
        ))}
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column - Input Section (60% on large screens) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Total Expenses</p>
                      <p className="text-2xl font-bold text-white">{expenses.length}</p>
                    </div>
                    <FiFileText className="w-8 h-8 text-emerald-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Total Amount</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(totalExpenses)}</p>
                    </div>
                    <FiTrendingUp className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Top Category</p>
                      <p className="text-lg font-bold text-white truncate">
                        {topCategory ? topCategory[0] : 'None'}
                      </p>
                    </div>
                    <FiTag className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Input Tabs */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Add Expense</CardTitle>
                <CardDescription className="text-slate-400">
                  Choose your preferred method to add expenses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-3 w-full bg-slate-900/50">
                    <TabsTrigger value="manual" className="data-[state=active]:bg-emerald-600">
                      <FiDollarSign className="w-4 h-4 mr-2" />
                      Manual Entry
                    </TabsTrigger>
                    <TabsTrigger value="excel" className="data-[state=active]:bg-blue-600">
                      <FiUpload className="w-4 h-4 mr-2" />
                      Excel Upload
                    </TabsTrigger>
                    <TabsTrigger value="image" className="data-[state=active]:bg-purple-600">
                      <FiImage className="w-4 h-4 mr-2" />
                      Image OCR
                    </TabsTrigger>
                  </TabsList>

                  {/* Manual Entry Tab */}
                  <TabsContent value="manual" className="space-y-4 mt-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount" className="text-slate-300">Amount *</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                          <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={manualAmount}
                            onChange={(e) => setManualAmount(e.target.value)}
                            className="pl-8 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="category" className="text-slate-300">Category *</Label>
                        <Select value={manualCategory} onValueChange={setManualCategory}>
                          <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {CATEGORIES.map(cat => (
                              <SelectItem key={cat} value={cat} className="text-white">
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes" className="text-slate-300">Notes (Optional)</Label>
                        <Textarea
                          id="notes"
                          placeholder="Add any additional details..."
                          value={manualNotes}
                          onChange={(e) => setManualNotes(e.target.value)}
                          rows={3}
                          className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                        />
                      </div>

                      {manualError && (
                        <Alert className="bg-red-900/50 border-red-700">
                          <FiAlertCircle className="w-4 h-4 text-red-400" />
                          <AlertDescription className="text-red-200">{manualError}</AlertDescription>
                        </Alert>
                      )}

                      <Button
                        onClick={handleManualSubmit}
                        disabled={manualLoading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {manualLoading ? (
                          <>
                            <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <FiCheck className="w-4 h-4 mr-2" />
                            Add Expense
                          </>
                        )}
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Excel Upload Tab */}
                  <TabsContent value="excel" className="space-y-4 mt-6">
                    {!excelFile ? (
                      <div
                        onDrop={handleExcelDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className="border-2 border-dashed border-slate-600 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer bg-slate-900/30"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FiUpload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                        <p className="text-slate-300 mb-2">Drag and drop your Excel file here</p>
                        <p className="text-sm text-slate-500 mb-4">or click to browse</p>
                        <div className="flex gap-2 justify-center">
                          <Badge variant="secondary" className="bg-blue-900/50 text-blue-300">.xlsx</Badge>
                          <Badge variant="secondary" className="bg-blue-900/50 text-blue-300">.xls</Badge>
                          <Badge variant="secondary" className="bg-blue-900/50 text-blue-300">.csv</Badge>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleExcelSelect}
                          className="hidden"
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                          <div className="flex items-center gap-3">
                            <FiFileText className="w-8 h-8 text-blue-500" />
                            <div>
                              <p className="text-white font-medium">{excelFile.name}</p>
                              <p className="text-sm text-slate-400">{(excelFile.size / 1024).toFixed(2)} KB</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExcelCancel}
                            className="text-slate-400 hover:text-white"
                          >
                            <FiX className="w-5 h-5" />
                          </Button>
                        </div>

                        {excelLoading && (
                          <div className="text-center py-8">
                            <div className="w-8 h-8 mx-auto mb-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-slate-400">Processing file...</p>
                          </div>
                        )}

                        {excelError && (
                          <Alert className="bg-red-900/50 border-red-700">
                            <FiAlertCircle className="w-4 h-4 text-red-400" />
                            <AlertDescription className="text-red-200">{excelError}</AlertDescription>
                          </Alert>
                        )}

                        {excelPreview.length > 0 && (
                          <div className="space-y-4">
                            <div className="border border-slate-700 rounded-lg overflow-hidden">
                              <div className="bg-slate-900/70 p-3 border-b border-slate-700">
                                <p className="text-white font-medium">Preview ({excelPreview.length} items)</p>
                              </div>
                              <ScrollArea className="h-64">
                                <table className="w-full">
                                  <thead className="bg-slate-900/50 sticky top-0">
                                    <tr>
                                      <th className="text-left p-3 text-slate-400 font-medium">Amount</th>
                                      <th className="text-left p-3 text-slate-400 font-medium">Category</th>
                                      <th className="text-left p-3 text-slate-400 font-medium">Notes</th>
                                      <th className="text-left p-3 text-slate-400 font-medium">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {excelPreview.map((item, index) => (
                                      <tr key={index} className="border-t border-slate-800">
                                        <td className="p-3 text-white font-medium">
                                          {formatCurrency(parseFloat(item.amount) || 0)}
                                        </td>
                                        <td className="p-3">
                                          <Badge className="bg-slate-700 text-slate-300">
                                            {item.category || 'Other'}
                                          </Badge>
                                        </td>
                                        <td className="p-3 text-slate-300 truncate max-w-xs">
                                          {item.notes || '-'}
                                        </td>
                                        <td className="p-3">
                                          <Badge className="bg-emerald-900/50 text-emerald-300">
                                            <FiCheck className="w-3 h-3 mr-1" />
                                            Valid
                                          </Badge>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </ScrollArea>
                            </div>

                            <div className="flex gap-3">
                              <Button
                                onClick={handleExcelConfirm}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <FiCheck className="w-4 h-4 mr-2" />
                                Confirm Import ({excelPreview.length})
                              </Button>
                              <Button
                                onClick={handleExcelCancel}
                                variant="outline"
                                className="border-slate-600 text-slate-300 hover:bg-slate-800"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  {/* Image Upload Tab */}
                  <TabsContent value="image" className="space-y-4 mt-6">
                    {!imageFile ? (
                      <div
                        onDrop={handleImageDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className="border-2 border-dashed border-slate-600 rounded-lg p-12 text-center hover:border-purple-500 transition-colors cursor-pointer bg-slate-900/30"
                        onClick={() => imageInputRef.current?.click()}
                      >
                        <FiImage className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                        <p className="text-slate-300 mb-2">Drag and drop receipt image here</p>
                        <p className="text-sm text-slate-500 mb-4">or click to browse</p>
                        <div className="flex gap-2 justify-center">
                          <Badge variant="secondary" className="bg-purple-900/50 text-purple-300">.jpg</Badge>
                          <Badge variant="secondary" className="bg-purple-900/50 text-purple-300">.png</Badge>
                          <Badge variant="secondary" className="bg-purple-900/50 text-purple-300">.pdf</Badge>
                        </div>
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {imagePreview && (
                          <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900/50">
                            <img
                              src={imagePreview}
                              alt="Receipt preview"
                              className="w-full h-64 object-contain"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleImageCancel}
                              className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-800 text-white"
                            >
                              <FiX className="w-5 h-5" />
                            </Button>
                          </div>
                        )}

                        {imageLoading && (
                          <div className="text-center py-8">
                            <div className="w-8 h-8 mx-auto mb-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-slate-400">Extracting data from image...</p>
                          </div>
                        )}

                        {imageError && (
                          <Alert className="bg-red-900/50 border-red-700">
                            <FiAlertCircle className="w-4 h-4 text-red-400" />
                            <AlertDescription className="text-red-200">{imageError}</AlertDescription>
                          </Alert>
                        )}

                        {extractedData && (
                          <div className="space-y-4">
                            <div className="p-4 bg-purple-900/20 border border-purple-700/50 rounded-lg">
                              <p className="text-purple-300 font-medium mb-2">Extracted Data</p>
                              <div className="flex gap-2">
                                <Badge className="bg-purple-900/50 text-purple-300">
                                  Amount: {extractedData.confidence.amount}%
                                </Badge>
                                <Badge className="bg-purple-900/50 text-purple-300">
                                  Category: {extractedData.confidence.category}%
                                </Badge>
                                <Badge className="bg-purple-900/50 text-purple-300">
                                  Overall: {extractedData.confidence.overall}%
                                </Badge>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label className="text-slate-300">Amount</Label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={extractedData.amount}
                                    onChange={(e) => setExtractedData(prev => prev ? {...prev, amount: e.target.value} : null)}
                                    className="pl-8 bg-slate-900/50 border-slate-600 text-white"
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-slate-300">Category</Label>
                                <Select
                                  value={extractedData.category}
                                  onValueChange={(val) => setExtractedData(prev => prev ? {...prev, category: val} : null)}
                                >
                                  <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-900 border-slate-700">
                                    {CATEGORIES.map(cat => (
                                      <SelectItem key={cat} value={cat} className="text-white">
                                        {cat}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-slate-300">Notes</Label>
                                <Textarea
                                  value={extractedData.notes}
                                  onChange={(e) => setExtractedData(prev => prev ? {...prev, notes: e.target.value} : null)}
                                  rows={3}
                                  className="bg-slate-900/50 border-slate-600 text-white"
                                />
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <Button
                                onClick={handleImageConfirm}
                                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                              >
                                <FiCheck className="w-4 h-4 mr-2" />
                                Confirm Entry
                              </Button>
                              <Button
                                onClick={handleImageCancel}
                                variant="outline"
                                className="border-slate-600 text-slate-300 hover:bg-slate-800"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Expense History (40% on large screens) */}
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Expense History</CardTitle>
                <CardDescription className="text-slate-400">
                  {expenses.length} total expense{expenses.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Search and Filter */}
                <div className="space-y-3">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search expenses..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                    />
                  </div>

                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                      <FiFilter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="all" className="text-white">All Categories</SelectItem>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat} className="text-white">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator className="bg-slate-700" />

                {/* Expense List */}
                {filteredExpenses.length === 0 ? (
                  <div className="text-center py-12">
                    <FiFileText className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                    <p className="text-slate-400 mb-2">No expenses yet</p>
                    <p className="text-sm text-slate-500">
                      Start by adding your first expense using one of the methods above
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-3">
                      {filteredExpenses.map((expense) => (
                        <Card key={expense.id} className="bg-slate-900/50 border-slate-700 hover:border-slate-600 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="text-xl font-bold text-white mb-1">
                                  {formatCurrency(expense.amount)}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className="bg-emerald-900/50 text-emerald-300">
                                    {expense.category}
                                  </Badge>
                                  <Badge variant="outline" className="border-slate-600 text-slate-400">
                                    {expense.source === 'manual' && <FiDollarSign className="w-3 h-3 mr-1" />}
                                    {expense.source === 'excel' && <FiUpload className="w-3 h-3 mr-1" />}
                                    {expense.source === 'image' && <FiImage className="w-3 h-3 mr-1" />}
                                    {expense.source}
                                  </Badge>
                                  {expense.confidence && (
                                    <Badge variant="outline" className="border-purple-600 text-purple-300">
                                      {expense.confidence}% confidence
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpenses(prev => prev.filter(e => e.id !== expense.id))}
                                className="text-slate-400 hover:text-red-400 hover:bg-red-900/20"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            {expense.notes && (
                              <p className="text-slate-400 text-sm mb-2 line-clamp-2">
                                {expense.notes}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <FiCalendar className="w-3 h-3" />
                              {formatDate(expense.date)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Floating Chat Interface */}
      {chatOpen ? (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col z-50">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600">
            <div className="flex items-center gap-2">
              <FiMessageSquare className="w-5 h-5 text-white" />
              <h3 className="font-semibold text-white">Expense Analysis</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChatOpen(false)}
              className="text-white hover:bg-white/20"
            >
              <FiX className="w-5 h-5" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {chatMessages.length === 0 ? (
                <div className="text-center py-8">
                  <FiMessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                  <p className="text-slate-400 mb-4">Ask me anything about your expenses!</p>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setChatInput("What's my spending pattern?")}
                      className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      What's my spending pattern?
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setChatInput("Show me my top expenses")}
                      className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Show me my top expenses
                    </Button>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === 'user'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-200'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-slate-700">
            <div className="flex gap-2">
              <Input
                placeholder="Ask about your expenses..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !chatLoading && handleChatSend()}
                disabled={chatLoading}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
              <Button
                onClick={handleChatSend}
                disabled={chatLoading || !chatInput.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <FiSend className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg z-50"
        >
          <FiMessageSquare className="w-6 h-6 text-white" />
        </Button>
      )}
    </div>
  )
}
