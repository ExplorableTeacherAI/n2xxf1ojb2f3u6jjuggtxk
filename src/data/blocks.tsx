import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    IcosahedraExplorer,
} from "@/components/atoms";

// Initialize variables and their colors from this file's variable definitions
import { useVariableStore, initializeVariableColors } from "@/stores";
import { getDefaultValues, variableDefinitions } from "./variables";
useVariableStore.getState().initialize(getDefaultValues());
initializeVariableColors(variableDefinitions);

/**
 * ------------------------------------------------------------------
 * BLOCK CONFIGURATION
 * ------------------------------------------------------------------
 * This file is the entry point for your lesson content.
 *
 * INSTRUCTIONS:
 * 1. Create your content using <Block> components.
 * 2. Use Layout components to organize your blocks.
 * 3. Add your blocks to the `blocks` array below.
 *
 * ------------------------------------------------------------------
 * CROSS-BLOCK VARIABLES
 * ------------------------------------------------------------------
 * Variables can be shared across blocks using the global store.
 *
 * DEFINE VARIABLES: src/data/variables.ts (use only variables.ts in this file; same structure as exampleBlocks + exampleVariables)
 *
 * USAGE IN BLOCKS:
 *
 * // Reading a value (auto-updates when changed):
 * import { useVar } from '@/stores';
 * const amplitude = useVar('amplitude', 1);
 *
 * // Setting a value:
 * import { useSetVar } from '@/stores';
 * const setVar = useSetVar();
 * setVar('amplitude', 2.5);
 *
 * // InlineScrubbleNumber (from variables.ts): getVariableInfo(name) + numberPropsFromDefinition(...)
 * <InlineScrubbleNumber varName="amplitude" {...numberPropsFromDefinition(getVariableInfo('amplitude'))} />
 *
 * ------------------------------------------------------------------
 * AVAILABLE LAYOUTS
 * ------------------------------------------------------------------
 *
 * 1. StackLayout
 *    - Best for: Title headers, introductory text, broad visualizations.
 *    - Usage:
 *      <StackLayout maxWidth="xl">
 *          <Block id="intro">...</Block>
 *      </StackLayout>
 *
 * 2. SplitLayout
 *    - Best for: Side-by-side content (e.g., Text + Visualization).
 *    - Usage:
 *      <SplitLayout ratio="1:1" gap="lg">
 *          <Block id="left">...</Block>
 *          <Block id="right">...</Block>
 *      </SplitLayout>
 *
 * 3. GridLayout
 *    - Best for: Multiple equal-sized items (cards, galleries).
 *    - Usage:
 *      <GridLayout columns={3} gap="md">
 *          <Block id="item-1">...</Block>
 *          <Block id="item-2">...</Block>
 *          <Block id="item-3">...</Block>
 *      </GridLayout>
 *
 * 4. ScrollytellingLayout
 *    - Best for: Narrative steps with a reactive sticky visualization.
 *    - Usage:
 *      <ScrollytellingLayout varName="scrollStep" visualPosition="right">
 *          <ScrollStep><Block id="step-0">...</Block></ScrollStep>
 *          <ScrollStep><Block id="step-1">...</Block></ScrollStep>
 *          <ScrollVisual><Block id="viz">...</Block></ScrollVisual>
 *      </ScrollytellingLayout>
 *
 * EXAMPLES:
 * See `src/data/exampleBlocks.tsx` for comprehensive examples.
 *
 * NOTE: If you are seeing examples in the browser instead of this content,
 * check your .env file and set VITE_SHOW_EXAMPLES=false.
 */

export const blocks: ReactElement[] = [
    // Title
    <StackLayout key="layout-icosahedra-title" maxWidth="full">
        <Block id="icosahedra-title" padding="md">
            <EditableH2 id="h2-icosahedra-title" blockId="icosahedra-title">
                The 59 Icosahedra Explorer
            </EditableH2>
        </Block>
    </StackLayout>,

    // Description
    <StackLayout key="layout-icosahedra-description" maxWidth="full">
        <Block id="icosahedra-description" padding="sm">
            <EditableParagraph id="para-icosahedra-description" blockId="icosahedra-description">
                Draw inside the equilateral triangle on the left, and watch your artwork appear on all 20 faces of the 3D icosahedron. The triangle starts with just its outline, so the icosahedron initially appears as a simple wireframe solid. As you add lines and shapes, you are exploring how a single triangular pattern can tile a regular polyhedron. Drag the 3D view to rotate and inspect your creation from any angle.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    // Interactive Explorer
    <StackLayout key="layout-icosahedra-explorer" maxWidth="full">
        <Block id="icosahedra-explorer" padding="lg" hasVisualization>
            <IcosahedraExplorer height={450} />
        </Block>
    </StackLayout>,
];
