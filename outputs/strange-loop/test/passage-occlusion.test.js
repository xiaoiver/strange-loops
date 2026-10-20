import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { openingVisibility } from '../src/passage-occlusion.js';

test('the passage floor sees less open sky as it recedes from the doorway', () => {
  const up=new Vector3(0,1,0);
  const front=openingVisibility(new Vector3(0,-3.8,-.03),up);
  const middle=openingVisibility(new Vector3(0,-3.8,-1),up);
  const deep=openingVisibility(new Vector3(0,-3.8,-3.2),up);
  assert.ok(front>.4&&front<=.5);
  assert.ok(front>middle&&middle>deep);
  assert.ok(deep<.1);
});

test('a surface facing away from the sole opening receives no direct sky', () => {
  assert.equal(openingVisibility(new Vector3(0,-1.8,-.8),new Vector3(0,0,-1)),0);
  assert.ok(openingVisibility(new Vector3(0,-1.8,-.8),new Vector3(0,0,1))>.3);
});
