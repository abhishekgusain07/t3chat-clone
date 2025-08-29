'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface ModelSelectorProps {
  selectedModel: string
  onModelChange: (model: string) => void
  userTier: 'Anonymous' | 'Free' | 'Pro' | 'Enterprise'
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  userTier,
}: ModelSelectorProps) {
  const availableModels = useQuery(api.availableModels.getByTier, {
    tier: userTier === 'Anonymous' ? 'Free' : userTier,
  })
  const updatePreferences = useMutation(api.userPreferences.createOrUpdate)

  const handleModelChange = async (modelId: string) => {
    onModelChange(modelId)

    // Update user preferences
    try {
      await updatePreferences({
        currentlySelectedModel: modelId,
      })
    } catch (error) {
      console.error('Failed to update model preference:', error)
    }
  }

  const selectedModelData = availableModels?.find(
    (m) => m.modelId === selectedModel
  )

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedModel} onValueChange={handleModelChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          {availableModels?.map((model) => (
            <SelectItem key={model._id} value={model.modelId}>
              <div className="flex items-center gap-2">
                <span>{model.displayName}</span>
                <div className="flex gap-1">
                  {model.isNew && (
                    <Badge variant="secondary" className="text-xs">
                      NEW
                    </Badge>
                  )}
                  {model.isBeta && (
                    <Badge variant="outline" className="text-xs">
                      BETA
                    </Badge>
                  )}
                  {model.requiredTier === 'Pro' && userTier === 'Free' && (
                    <Badge variant="destructive" className="text-xs">
                      PRO
                    </Badge>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedModelData && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>{selectedModelData.creditsPerMessage} credits</span>
          {selectedModelData.supportsVision && (
            <Badge variant="outline" className="text-xs">
              Vision
            </Badge>
          )}
          {selectedModelData.supportsTools && (
            <Badge variant="outline" className="text-xs">
              Tools
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
