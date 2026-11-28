#!/usr/bin/env ruby
# frozen_string_literal: true
# Adds a UI test target to the project `expo prebuild` just generated, and a
# shared scheme that runs it. The generated project is disposable -- prebuild
# overwrites ios/ -- so the target is created here instead of being checked in.
#
# Usage: ruby scripts/add-uitest-target.rb   (from examples/books-expo)
require 'xcodeproj'

TEST_NAME = 'SwipelineSmokeUITests'
SOURCES = '../uitest'

project_path = Dir.glob('ios/*.xcodeproj').max
abort 'no ios/*.xcodeproj found; run `npx expo prebuild --platform ios` first' if project_path.nil?

project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.product_type == 'com.apple.product-type.application' }
abort "#{project_path} has no application target" if app.nil?

if project.targets.any? { |target| target.name == TEST_NAME }
  puts "#{TEST_NAME} is already in #{project_path}"
  exit 0
end

target = project.new_target(:ui_test_bundle, TEST_NAME, :ios, app.deployment_target)

# The test bundle hosts the app rather than linking it.
target.add_dependency(app)

group = project.main_group.new_group(TEST_NAME, SOURCES)
target.source_build_phase.add_file_reference(group.new_file('SmokeUITests.swift'))

target.build_configurations.each do |configuration|
  settings = configuration.build_settings
  settings['TEST_TARGET_NAME'] = app.name
  settings['PRODUCT_BUNDLE_IDENTIFIER'] = "dev.swipeline.expo.#{TEST_NAME}"
  settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  settings['CODE_SIGNING_ALLOWED'] = 'NO'
  # Swift 5 mode: the test makes no concurrency claims, and Swift 6 mode would
  # make XCUITest's main-actor annotations a build error on newer toolchains.
  settings['SWIFT_VERSION'] = '5.0'
end

project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_test_target(target)
scheme.set_launch_target(app)
scheme.save_as(project_path, TEST_NAME, true)

puts "Added #{TEST_NAME} to #{project_path} (app target: #{app.name}, iOS #{app.deployment_target})"
